const fs = require("fs");
const path = require("path");
const through = require('through');
const Utils = require("./utils").utils;
const Cache = require("./app/cache");

const moment = require('moment')

const Koa = require("koa");
const serve = require('koa-static');
const router = require("koa-router")();
const views = require('koa-views');
const bodyParser = require("koa-body");
const asyncRedis = require("async-redis")
const client = asyncRedis.createClient()

const ejsexcel = require("ejsexcel");
const nikeNetServ = require("./service/nikeNet");
const sjClientServ = require("./service/sjClient");
const nikeNetRequestServ = require("./service/nikeNetRequest");

const spawn = require('child_process').spawn;

const app = new Koa();

const CACHE = {}

app.use(serve(__dirname + '/static'));
app.use(serve(path.resolve(__dirname, '../duole-erp-cli/excel')));
app.use(views(__dirname, { extension: 'pug' }))


app.use(bodyParser({
  multipart: true,
  formLimit: '56mb',
  jsonLimit: '56mb',
  textLimit: '56mb',
}));

app.use(router.routes());


const checkUser = async (ctx, next) => {

  console.log('ctx.cookies')
  const cookieUser = ctx.cookies.get('user')
  console.log(cookieUser)

  // ctx.cookies.set('user', (+ new Date()), {
  //   // domain: 'localhost',  // 写cookie所在的域名
  //   path: '/',       // 写cookie所在的路径
  //   maxAge: 24 * 60 * 60 * 1000, // cookie有效时长
  //   // expires: new Date('2017-02-15'),  // cookie失效时间
  //   httpOnly: false,  // 是否只用于http请求中获取
  //   overwrite: false  // 是否允许重写
  // })
  

  if (!cookieUser) {
    ctx.redirect('/login')
  } else {
    const cookieParts = cookieUser.split('_')
    if ( cookieParts.length < 2 || (+ new Date()) - parseInt(cookieParts[1])  > 1000 * 60 * 60 ) {
      ctx.redirect('/login')
    } else {
      if (cookieParts.length === 2) {
        ctx.cookies.set('user', cookieParts[0]+'_'+(+ new Date()), {
          // domain: 'localhost',  // 写cookie所在的域名
          path: '/',       // 写cookie所在的路径
          maxAge: 24 * 60 * 60 * 1000, // cookie有效时长
          // expires: new Date('2017-02-15'),  // cookie失效时间
          httpOnly: false,  // 是否只用于http请求中获取
          overwrite: false  // 是否允许重写
        }) 
      }

    }
  }

  await next()
}

// 导出库存
router.get('/exec', async function(ctx){
    let cmd = ctx.query.cmd, args = ctx.query.args;
    args = args || []
    if (typeof(args) === 'string') args = [args]
    // const params = [`/node/duole-server-cli/${cmd}.js`, ...args]
    const params = [`/node/duole-erp-cli/nikeToXlsWithAbsolutePath.js`]
    console.log('params')
    console.log(params)
    const ls = spawn('node', params);

    const tr = through();

    ls.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
      tr.write(data)
    });

    ls.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
      tr.write(data)
    });

    ls.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
      tr.end()
    });

    ctx.set("content-type", "text/html;charset=utf-8")
    ctx.body = tr
})


// 登录
router.get("/login", async (ctx) => {
  await ctx.render('views/login.pug');
})

// 登录
router.post("/login", async (ctx) => {
  let res = null
  try {
    res = await sjClientServ.getClient(ctx.request.body)
  } catch (e) {
    console.log(e)

    ctx.status = 200
    ctx.body = {
      code: -1,
      err: e.message,
      body: ctx.request.body,
    }
    return;
  }


  ctx.cookies.set('user', res.id+'_'+(+ new Date()), {
    // domain: 'localhost',  // 写cookie所在的域名
    path: '/',       // 写cookie所在的路径
    maxAge: 24 * 60 * 60 * 1000, // cookie有效时长
    // expires: new Date('2017-02-15'),  // cookie失效时间
    httpOnly: false,  // 是否只用于http请求中获取
    overwrite: false  // 是否允许重写
  })

  ctx.status = 200
  ctx.body = {
    user: res,
    body: ctx.request.body,
  }
})

// 获得最近更新的sku
router.get("/newArrival", checkUser, async (ctx) => {
  // console.log(nikeNetServ)

  const query = ctx.query || {}
  let ls = await nikeNetServ.getRecentChanges(query)


  ls.forEach((it) => {
    if(it.type==='newSku' || it.type==='newBatches') {
      it.stockChange = it.stock
    }
    try {
      it.stockChange = JSON.parse(it.stockChange)
    } catch (e) {}
    try {
      it.stock = JSON.parse(it.stock)
    } catch (e) {}
  })
  // console.log(ls)
  ctx.state = { ls: JSON.stringify(ls), query: JSON.stringify(query) };
  await ctx.render('views/newArrival.pug');
})

// 获得sku数据
router.get("/api/skuinfo", checkUser, async (ctx) => {
  const query = ctx.query || {}
  const {sku} = query

  let res = await client.get('cache_'+sku)
  if (res) {
    ctx.status = 200
    ctx.body = JSON.parse(res)
    console.log('from cache')
    return 
  }
  console.log('no cache, loading')

  let info = await nikeNetRequestServ.getInfoBySku(sku)
  let stock = await nikeNetRequestServ.getRealTimeStockBySku(sku)

  let allsizes = {}
  let sizes = {}
  if (stock.length > 0) {

    allsizes = stock[0].productAvailabilities
    if (allsizes && allsizes.length > 0) allsizes = allsizes[0]
    if (allsizes.availabilities) allsizes = allsizes.availabilities
    

    console.log('allsizes')
    console.log(allsizes)
    if (allsizes) {

      allsizes.forEach((it) => {
        if (it.date > (+ new Date())) {
        } else {
          sizes = {}
          it.sizes.forEach((ob) => {
            sizes[`${ob.code}`] = ob.quantity
          })
        }
      }) 
    } else {

    }
  }

  if (info && info.length > 0) info = info[0]
  delete info.sizes
  delete info.availability

  info.languages.forEach((it) => {
    if(it.locale.language.toUpperCase() === 'ZH'){
      for(const k in it){
        info[k] = it[k]
      }
    }
  })
  delete info.languages

  const body = {
    sizes,
    // batches: allsizes,
    // stock: stock[0].productAvailabilities,
    info,
  }

  await client.set('cache_'+sku, JSON.stringify(body), 'EX', 60 * 3)

  ctx.status = 200
  ctx.body = body
})


const port = 8001
app.listen(port).setTimeout(1000 * 60 * 5);

console.log("the server is listening on port "+port)

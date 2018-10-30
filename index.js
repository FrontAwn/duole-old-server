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
const nikeNetRequestServ = require("./service/nikeNetRequest");

const spawn = require('child_process').spawn;
// const koaNunjucks = require('koa-nunjucks-2');

const sj = require('sj')
const { helper } = sj
const { table } = helper

const mysql2 = require('mysql2')
const $db = require('mysql-promise')('sj-resource')

const $devType = process.env.NODE_ENV || 'production'
const $isDev = process.env.NODE_ENV === 'dev' ? true:false

const configMysql = require('./config/mysql.'+$devType+'.js')
// $db.configure(configMysql.mysql, mysql2)
$db.configure(configMysql.mysql)
// console.log(configMysql)

// console.log('process.env')
// console.log(process.env)
// console.log('isDev:' + $isDev)

// if ($isDev) {
//   $db.configure(configMysql.mysql, mysql2)
// } else {
//   $db.configure(configMysql.mysql, mysql2) 
// }



const app = new Koa();

const CACHE = {}

app.use(serve(__dirname + '/static'));
app.use(serve(__dirname + '/downloads'));
app.use(views(__dirname, { extension: 'pug' }))


// app.use(koaNunjucks({
//   ext: 'nj',
//   path: path.join(__dirname, 'views'),
//   nunjucksConfig: {
//     trimBlocks: true
//   }
// }))


const uploadDir = 'uploads';


const getDownloadFilePath = (file, tip='') => {
  const resolvedPath = path.resolve('/node/duole-server/downloads', file)
  // const resolvedPath = path.resolve(__dirname, file)
  // console.log('getFilePath:', tip, resolvedPath)
  return resolvedPath
}


const renderExcel = async (template, dist, data) => {
  return new Promise((res, rej) => {

    const exlBuf = fs.readFileSync(getDownloadFilePath(template));

    ejsexcel.renderExcel(exlBuf, data).then(function(exlBuf2) {
      fs.writeFileSync(getDownloadFilePath(dist),exlBuf2);

      res(null)
      // process.exit()

    }).catch(function(err) {
     console.error(err);
     rej('err')
    });

  })
}


app.use(bodyParser({
  multipart: true,
  formLimit: '56mb',
  jsonLimit: '56mb',
  textLimit: '56mb',
}));
app.use(router.routes());

router.get("/", async (ctx) => {
    const ls = []
    const query = {}
    ctx.state = { ls, query };
    await ctx.render('views/indexV3.html');
})

router.get("/atp1028", async (ctx) => {
    const ls = []
    const query = {}
    ctx.state = { ls, query };
    await ctx.render('views/index1028V1.html');
})


router.get("/ing", async (ctx) => {
  let ls = await client.lrange('nike_atp_changes', 0, -1)

  // ls.forEach((it, idx) => {
  //   if (it.indexOf('AA0521-006') > -1) {
  //     console.log(it)
  //     itJ = JSON.parse(it)
  //     console
  //     xxxx
  //   }
  // })
  const query = {}
  ctx.state = { ls, query };
  await ctx.render('views/ing.pug', {
    ls,
    query,
  });
})



router.get("/official-skuinfo-withcache", async (ctx) => {
  const query = ctx.query || {}
  const {sku} = query

  let sizes = CACHE['sizes_'+sku] || {}

  if (Object.keys(sizes).length === 0) {

    let stock = await nikeNetRequestServ.getRealTimeStockBySku(sku)

    let allsizes = {}
    sizes = {}
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

    CACHE['sizes_'+sku] = sizes
  }


  let skuInfo = CACHE['info_'+sku] || {}
  if (!skuInfo.id) {

    let info = await nikeNetRequestServ.getInfoBySku(sku)

    if (info && info.length > 0) info = info[0]
    // delete info.sizes
    // delete info.availability

    info.languages.forEach((it) => {
      if(it.locale.language.toUpperCase() === 'ZH'){
        for(const k in it){
          info[k] = it[k]
        }
      }
    })
    delete info.languages
    skuInfo = info
  }

  ctx.status = 200
  ctx.body = {
    sizes,
    batches: allsizes,
    // stock: stock[0].productAvailabilities,
    info: skuInfo,
  }
})




router.get("/official-skuinfo", async (ctx) => {
  const query = ctx.query || {}
  const {sku} = query

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
  // delete info.sizes
  // delete info.availability

  info.languages.forEach((it) => {
    if(it.locale.language.toUpperCase() === 'ZH'){
      for(const k in it){
        info[k] = it[k]
      }
    }
  })
  delete info.languages

  ctx.status = 200
  ctx.body = {
    sizes,
    batches: allsizes,
    // stock: stock[0].productAvailabilities,
    info,
  }
})

router.get("/official-change", async (ctx) => {
  console.log(nikeNetServ)

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
  await ctx.render('views/official-change.pug');

})



router.get("/forecast", async (ctx) => {
  let ls = await client.get('nike_stock_forecast')
  
  const query = {}
  ctx.state = { ls, query };
  await ctx.render('views/forecast.pug', {
    ls,
    query,
  });
})



router.get("/redis/set", async (ctx) => {
  let key = ctx.query.key
  let value = decodeURIComponent(escape(ctx.query.value))
  console.log(value)
  let res = await client.set(key, value)

  ctx.status = 200
  ctx.body = {
    res: res,
  }
})

router.get("/redis/get", async (ctx) => {
  let key = ctx.query.key
  let value = ctx.query.value
  let res = await client.get(key)

  ctx.status = 200
  ctx.body = {
    res: res,
  }
})

router.post("/export/xlsx", async (ctx) => {

  let name = ctx.query.name || moment().format('YYYY-MM-DD');
  let localstorage_hide_skus = {}
  let localstorage_skus_str = []
  let localstorage_need_amount = {}
  try {
    let localstorage_hide_skus = JSON.parse(ctx.query.localstorage_hide_skus)
    let localstorage_skus_str = JSON.parse(ctx.query.localstorage_skus_str)
    let localstorage_need_amount = JSON.parse(ctx.query.localstorage_need_amount)
  } catch (e) {
    localstorage_hide_skus = {}
  }

  // console.log('ctx.body')
  ctx.body = ctx.request.body;
  // console.log(ctx.body)

  let plant = ctx.body.plant || null
  let sizesWithPlant = 'sizes'
  if (plant) {
    sizesWithPlant = 'sizes_'+plant
  }
  console.log('sizesWithPlant:' + sizesWithPlant)
  
  name = ctx.body.name || moment().format('YYYY-MM-DD')
  localstorage_hide_skus = JSON.parse(ctx.body.localstorage_hide_skus)
  localstorage_skus_str = JSON.parse(ctx.body.localstorage_skus_str)
  localstorage_need_amount = JSON.parse(ctx.body.localstorage_need_amount)

  // 从当前官方库信息中读取有效的sku
  let ls = await client.mget([...localstorage_skus_str])

  const res = {
    sizes: [],
    rows: [],
  }

  // 待优化，使用更全的sizes
  const allSizes = 'XS,S,M,L,XL,XXL,XXXL,XXXXL,2XL,3XL,4XL,1,3,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10,10.5,11,11.5,12,12.5,13,30,32,34,10-,12-,14-16,1SIZE,2XLT,3XLT,3XL-T,4.5Y,4-5.5,4XL-T,4Y,5XL,6-7.5,7Y,8-9.5,L/XL,M/L,MISC,PRO,S/M,XXS'.split(',')

  const showSizes = []

  const sizesMap_HaveValue = {}

  console.log('localstorage_need_amount[sku]')
  console.log(localstorage_need_amount['904716-001'])


  ls.forEach((it, idx) => {
    it = JSON.parse(it) || 'undefined'
    ls[idx] = it

    if (it !== 'undefined') {

      const sku = it.sku

      // console.log('idx:' + idx + ' sku:' + sku)
      // console.log('localstorage_need_amount[sku]:' + localstorage_need_amount[sku])

      // 排除直接x掉的
      localstorage_hide_skus = localstorage_hide_skus || {}

      if (sku === '537384-111') {
        console.log('ls[idx] before')
        console.log(ls[idx])
      }

      ls[idx].sizes = ls[idx][sizesWithPlant] || {}

      if (sku === '537384-111') {
        console.log('ls[idx].sizes after:' + sizesWithPlant)
        console.log(ls[idx].sizes)
      }

      // 没有被隐藏
      if (ls[idx] && ls[idx].sizes && (!localstorage_hide_skus[sku] || `${localstorage_hide_skus[sku]}` === '0')) {

        // 删除特殊尺码
        ['13.5', '14', '14.5', '15', '15.5', '16', '16.5', '17', '17.5', '18', '18.5', '19', '19.5', '20'].forEach((size) => {
          ls[idx].sizes[size] = null
          delete ls[idx].sizes[size]
        })

        if (ls[idx]!=='undefined') {
          ls[idx].sizes = ls[idx].sizes || {}
          Object.keys(ls[idx].sizes).forEach((size) => {

            localstorage_need_amount[sku] = localstorage_need_amount[sku] || {}
            let need = ls[idx].sizes[size]
            if (localstorage_need_amount[sku][size] || `${localstorage_need_amount[sku][size]}` === '0') {
              need = localstorage_need_amount[sku][size]
            }

            // console.log('idx:' + idx + ' size:'+size+ ' need:' + need)
            ls[idx].sizes[size] = need

            if (`${ls[idx].sizes[size]}` === '0') {
              ls[idx].sizes[size] = null
              delete ls[idx].sizes[size]
            }

          })
          // 循环附值各size需求数量 E
        }

        // console.log('allSizes')
        // console.log(allSizes)
        // console.log('ls')
        // console.log(ls)


        if (ls[idx]!=='undefined' && ls[idx].sizes) {
          ls[idx].sum = 0
          Object.keys(ls[idx].sizes).forEach(size => {
            ls[idx].sum += parseInt(ls[idx].sizes[size])
            sizesMap_HaveValue[`${size}`] = 1

            if (sku === '904716-001') {
              console.log('size:' + size + ' = '+ls[idx].sizes[size])
            }

          })
          // 计算需求sum E

          if (ls[idx].sum > 0) {
            res.rows.push(ls[idx]) 
          }
        }
      }

    }


  })
  // console.log(res)
  console.log('正在导出')
  // console.log(sizesMap_HaveValue)


  allSizes.forEach((size) => {
    size = `${size}`
    if (sizesMap_HaveValue[size] && showSizes.indexOf(size) === -1) {
      // console.log(size)
      showSizes.push(size)
      sizesMap_HaveValue[size] = null
      delete sizesMap_HaveValue[size]
    }
  })

  Object.keys(sizesMap_HaveValue).forEach(size => {
    size = `${size}`
    if (showSizes.indexOf(size) === -1) {
      showSizes.push(size)
    }
  })

  res.sizes = showSizes

  await renderExcel("../template/报货_template.xlsx", `./${name}.xlsx`, res)

  ctx.status = 200
  ctx.body = {'done':1}

  // ctx.body = {
  //   localstorage_hide_skus,
  //   localstorage_skus_str,
  //   localstorage_need_amount,
  //   ls,
  // }
})


// 获得分页数据
router.get("/page", async (ctx) => {
  let key = ctx.query.key
  let size = parseInt(ctx.query.size) || 1
  let page = parseInt(ctx.query.page) || 1
  let res = await client.get(key)
  res = JSON.parse(res)
  const total = res.length
  let ls = res.slice((page - 1)*size, page * size)
  ls = await client.mget([...ls])

  ls.forEach((it, idx) => {
    ls[idx] = JSON.parse(it) || 'undefined'
  })
  // 返回total，page

  ctx.set("content-type", "application/javascript;charset=utf-8")
  ctx.status = 200
  ctx.body = {
    total,
    size,
    page,
    ls,
  }
})

// 获得redis数据
router.get("/mem", async (ctx) => {
  let key = ctx.query.key
  let type = ctx.query.type
  let res = await client.get(key)
  if (type === 'json') res = JSON.parse(res)

  ctx.set("content-type", "application/javascript;charset=utf-8")
  ctx.status = 200
  ctx.body = res
})

// 获得redis里的数据
router.get("/mems", async (ctx) => {
  let keys = ctx.query.key
  let type = ctx.query.type

  if (typeof(keys) === 'string') keys = [keys]

  const finds = await client.mget([...keys])
  const res = {}
  finds.forEach((it, idx) => {
    if (type === 'json') it = JSON.parse(it)
    res[keys[idx]] = it || 'undefined'
  })
  // console.log(res)

  ctx.set("content-type", "application/javascript;charset=utf-8")
  ctx.status = 200
  ctx.body = {
    status: 0,
    data: res,
  }
})


// 给sku排序
router.get("/sku/sort", async (ctx) => {
  let skus = ctx.query.skus
  let sortby = ctx.query.sortby
  skus = skus.split(',')

  const finds = await client.mget([...skus])
  const skuMap = {}
  finds.forEach((it, idx) => {
    try {
      it = JSON.parse(it)
    } catch (e) {
      it = {}
    }
    skuMap[skus[idx]] = it || {}
  })

  sortby = sortby.split('||')

  // 根据key排序
  const sortByKey = (key, order) => {
    return (a, b) => {
      console.log(skuMap[a])
      if (order === 'asc') {
        return skuMap[a][key] >= skuMap[b][key]
      } else {
        return skuMap[a][key] < skuMap[b][key]
      }
    }
  }

  sortby.forEach((sortStr) => {
    const [key, order] = sortStr.split('::')
    skus.sort(sortByKey(key, order))
  })

  ctx.set("content-type", "application/javascript;charset=utf-8")
  ctx.status = 200
  ctx.body = skus
})


router.get('/exec', async function(ctx){
    let cmd = ctx.query.cmd, args = ctx.query.args;
    args = args || []
    if (typeof(args) === 'string') args = [args]
    const params = [`/node/duole-server-cli/${cmd}.js`, ...args]
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


// router.get('/exec/file', async function(ctx){
//     let fileName = ctx.query.fileName, fileMd5Value = ctx.query.fileMd5Value;

//     const ls = spawn('node',['/node/duole-server-cli/parse.js', fileName]);

//     const tr = through();

//     ls.stdout.on('data', (data) => {
//       console.log(`stdout: ${data}`);
//       tr.write(data)
//     });

//     ls.stderr.on('data', (data) => {
//       console.log(`stderr: ${data}`);
//       tr.write(data)
//     });

//     ls.on('close', (code) => {
//       console.log(`child process exited with code ${code}`);
//       tr.end()
//     });

//     ctx.set("content-type", "text/html;charset=utf-8")
//     ctx.body = tr
// })






// router.get("/exec", function(ctx){
//   const ls = spawn('node',['/node/duole/stock-self.js']);
//   // const ls = spawn('ls', ['-lh', '/usr']);

//   ls.stdout.on('data', (data) => {
//     console.log(`stdout: ${data}`);
//   });

//   ls.stderr.on('data', (data) => {
//     console.log(`stderr: ${data}`);
//   });

//   ls.on('close', (code) => {
//     console.log(`child process exited with code ${code}`);
//   });

// })













router.get("/epr", async (ctx) => {
    const ls = []
    const query = {}
    ctx.state = { ls, query };
    await ctx.render('views/indexV3.html');
})

router.get("/epr-reset", function(ctx){
    ctx.response.type = 'html';
    ctx.response.body = fs.createReadStream('./index-upload.html');
})

router.get("/index", function(ctx){
    ctx.response.type = 'html';
    ctx.response.body = fs.createReadStream('./index.html');
})

router.get("/index-upload", function(ctx){
    ctx.response.type = 'html';
    ctx.response.body = fs.createReadStream('./index-upload.html');
})





router.get('/check/file', async function(ctx){
    let fileName = ctx.query.fileName, fileMd5Value = ctx.query.fileMd5Value;
    
    await Utils.getChunkList(path.join(uploadDir, fileName), path.join(__dirname, uploadDir, fileMd5Value), 
        data => {
            ctx.response.body = data;
        }
    )
})

router.post('/upload', async function(ctx){
    let data = ctx.request.body.fields,
        currChunk = data.currChunk,
        totalChunks = data.totalChunks,
        fileMd5Value = data.fileMd5Value,
        file = ctx.request.body.files,
        folder = path.join('uploads', fileMd5Value);
    let isExist = await Utils.folderIsExist(path.join(__dirname, folder));
    if(isExist){
        let destFile = path.join(__dirname, folder, currChunk),
            srcFile = path.join(file.data.path);
        await Utils.copyFile(srcFile, destFile).then(() => {
            ctx.response.body = 'chunk ' + currChunk + ' upload success!!!'
        }, (err) => {
            console.error(err);
            ctx.response.body = 'chunk ' + currChunk + ' upload failed!!!'
        })
    }
})

router.get("/mergeChunk", async function(ctx){
    let md5 = ctx.query.md5,
        fileName = ctx.query.fileName,
        size = ctx.query.size;

    await Utils.mergeFiles(path.join(__dirname, uploadDir, md5), 
                           path.join(__dirname, uploadDir),
                           fileName, size)

    ctx.response.body = "success";
})

router.get("/epr/filtered", async (ctx) => {
  const eprStr = await client.get('sku_pre_check')
  ctx.set("content-type", "application/javascript;charset=utf-8")
  ctx.status = 200
  ctx.body = eprStr
})



router.get("/taobao/xls", async (ctx) => {

  const DbProducts = table('taobao_products', {
    db: $db,
    indexBy: 'id',
  })
  const DbProduct = table('taobao_product', {
    db: $db,
    indexBy: 'id',
  })

  const products = await DbProducts.realfinds('*', "id > 0")
  // console.log('products')
  // console.log(products)

  const product = await DbProduct.realfinds('*', "1 > 0 limit 0, 3000000")
  // console.log('product')
  // console.log(product)

  product.forEach((it) => {
      // console.log(it)
    if (('_'+it.outer_id).indexOf('832219') > 0) {
      console.log(it)
    }
  })
  console.log(product.length)

  const res = {
    products,
    product,
  }

  await renderExcel("../template/淘宝商品列表_template.xlsx", `./淘宝商品列表_${moment().format('YYYY-MM-DD HH-mm-ss')}.xlsx`, res)

  ctx.status = 200
  ctx.body = {'done':1}
})



const controller = require('./controller')
controller.handle({
  $router: router,
  $redis: client,
  $renderExcel: renderExcel,
  $table: table,
  $db,
  $isDev,
})


let port = 8010
if (process.argv.length > 2) {
  port = process.argv[2]
}

app.listen(port).setTimeout(1000 * 60 * 5);

console.log("the server is listening on " + port)


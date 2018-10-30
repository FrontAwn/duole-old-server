const fs = require("fs");
const path = require("path");
const through = require('through');
const Utils = require("./utils").utils;
const Cache = require("./app/cache");

const Koa = require("koa");
const serve = require('koa-static');
const router = require("koa-router")();
const views = require('koa-views');
const bodyParser = require("koa-body");
const asyncRedis = require("async-redis")
const client = asyncRedis.createClient()

const spawn = require('child_process').spawn;

const app = new Koa();

app.use(serve(__dirname + '/static'));
app.use(views(__dirname, { extension: 'pug' }))

const uploadDir = 'uploads';

app.use(bodyParser({multipart: true}));
app.use(router.routes());

router.get("/", async (ctx) => {
    // ctx.response.redirect("/index");
    const ls = []
    const query = {}
    ctx.state = { ls, query };
    await ctx.render('views/index');
})


router.get("/epr/filtered", async (ctx) => {
  const eprStr = await client.get('sku_pre_check')
  ctx.set("content-type", "application/javascript;charset=utf-8")
  ctx.status = 200
  ctx.body = eprStr
})

// 获得redis数据
router.get("/mem", async (ctx) => {
  let key = ctx.query.key
  const res = await client.get(key)
  ctx.set("content-type", "application/javascript;charset=utf-8")
  ctx.status = 200
  ctx.body = JSON.parse(res)
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
  ctx.body = res
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

app.listen(3000).setTimeout(1000 * 60 * 5);

console.log("the server is listening on port 3000")
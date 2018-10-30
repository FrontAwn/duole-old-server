
exports.handle = ({ $router, $table, $db }) => {

  $router.get("/info/comm", async (ctx) => {
    console.log('/info/comm...')

    const type = ctx.query.type || 'nike'
    const sku = ctx.query.sku || null

    // 没找到
    if (!sku) {
      ctx.set("content-type", "application/javascript;charset=utf-8")
      ctx.status = 200
      ctx.body = ''
      return
    }

    const DbSku = $table('v1_comm_skuInfo', {
      db: $db,
      indexBy: 'id',
    })
    
    // 没找到
    const info = await DbSku.find('*', "sku='"+sku+"' ORDER BY id ASC LIMIT 1")
    console.log('info')
    console.log(info)

    // [-todo-]补充成本和流速数据

    ctx.set("content-type", "application/javascript;charset=utf-8")

    ctx.status = 200
    if (info) {
      ctx.body = info
    } else {
      ctx.body = ''
    }
  })


  // 
  $router.get("/info/comm/view", async (ctx) => {
    console.log('/info/comm...')

    const type = ctx.query.type || 'nike'
    const sku = ctx.query.sku || null

    // 没找到
    if (!sku) {
      ctx.set("content-type", "application/javascript;charset=utf-8")
      ctx.status = 200
      ctx.body = ''
      return
    }

    const DbSku = $table('v1_comm_skuInfo', {
      db: $db,
      indexBy: 'id',
    })
    
    // 没找到
    const info = await DbSku.find('*', "sku='"+sku+"' ORDER BY id ASC LIMIT 1")
    console.log('info')
    console.log(info)

    // [-todo-]补充成本和流速数据

    const ls = [1, 2, 3]
    const query = {
      a: 'a v',
      b: 'b v',
    }
    // ctx.state = { ls, query, info }
    await ctx.render('views/info_comm.pug', { ls, query, info })
  })

}


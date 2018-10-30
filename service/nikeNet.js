const { helper } = require('sj')
const { table, folder } = helper

var child_process = require("child_process")
const asyncRedis = require("async-redis")
const client = asyncRedis.createClient()

var mysql2 = require('mysql2');
var db = require('mysql-promise')('sj_nike_stock');
var opts = {
  "host": "localhost",
  "user": "root",
  "password": "Abc12345",
  "database": "2018_cf_adidasnike_bz"
};

var opts = {
  "host": "localhost",
  "user": "song",
  "password": "SongAbc12345",
  "database": "sj_nike_stock"
};


db.configure(opts);
console.log(opts)

const DbNikeStockChange = table('nike_stock_change', {
  db,
  indexBy: 'id',
})


const getRecentChanges = async (query) => {
  let {page = 1, length = 10, sku = null, type=''} = query
  const start = (page -1 )*length
  const end = start + length
  let findSkuStr = ''
  if (sku) {
    findSkuStr += (`sku='${sku}' AND `)
  }
  if (type) {
    let typeKey = ''
    if (type === 'ap') typeKey = 'APRL'
    if (type === 'fw') typeKey = 'FTWR'
    if (type === 'eq') typeKey = 'EQMT'
    findSkuStr += (`skuType='${typeKey}' AND `)
  }


  const [ls, fields] = await DbNikeStockChange.finds('*', ` ${findSkuStr} orderScore>=2 ORDER BY orderScore DESC,id DESC LIMIT ${start}, ${length}`)
  return ls
}


exports.getRecentChanges = getRecentChanges

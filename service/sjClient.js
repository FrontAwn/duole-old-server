const { helper } = require('sj')
const { table, folder } = helper

var child_process = require("child_process")
const asyncRedis = require("async-redis")
const client = asyncRedis.createClient()

var mysql2 = require('mysql2');
var db = require('mysql-promise')();
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


db.configure(opts, mysql2);

const DbSjClient = table('sj_client', {
  db,
  indexBy: 'id',
})


const getClient = async (query) => {
  console.log(query)

  let {user = null, password = null} = query
  let findSkuStr = ''
  findSkuStr = `user='${user}' `
  console.log('findSkuStr')
  console.log(findSkuStr)

  const [ls, fields] = await DbSjClient.finds('*', ` ${findSkuStr} LIMIT 1`)
  if (ls.length < 1) {
    throw new Error('no user')
  }
  if (password !== ls[0].password) {
    throw new Error('err password')
  }
  delete ls[0].password
  return ls[0]
}


exports.getClient = getClient

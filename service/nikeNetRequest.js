var child_process = require("child_process")
var fs = require('fs')
var path = require('path')

const moment = require('moment')
const asyncRedis = require("async-redis")
const client = asyncRedis.createClient()

let HEADERS = null
let batchIdx = 0

let CACHE_skusInfo = {}
let CACHE_skusInfo_closeout = {}

const getCookieStr = async () => {
  let cookieStr = ''
  try {
    let cookieArrStr = await client.get('https://www.nike.net')
    if (cookieArrStr) {
      cookieArrStr = JSON.parse(cookieArrStr)
    } 

    let cookieArr = cookieArrStr
    let cookieKVArr = []
    cookieArr.forEach((cookie) => {
      cookieKVArr.push(`${cookie.name}=${cookie.value}`)
    })

    cookieStr = cookieKVArr.join('; ')
    // console.log('cookieArrStrcookieArrStrcookieArrStr'); 
    // console.log(cookieArrStr)
  } catch (e) {
    throw new Error('invalid_cookie')
  }
  return cookieStr
}

const getNewHeader = async () => {
  const cookieStr = await getCookieStr()
  if (!cookieStr) {
    throw new Error('headerIsInValid')
    return false
  }

  HEADERS = `-H 'Connection: keep-alive' -H 'Cache-Control: max-age=0' -H 'Upgrade-Insecure-Requests: 1' -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36' -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8' -H 'Accept-Encoding: gzip, deflate, br' -H 'Accept-Language: en-US,en;q=0.9,ja;q=0.8,zh-CN;q=0.7,zh;q=0.6,es;q=0.5,zh-TW;q=0.4,mt;q=0.3' -H 'Cookie: ${cookieStr}'`

  return HEADERS
}


const retryWrapper = async (func, retry = 3) => {
  let tryTimes = 0
  let res = null
      // res = await func()
  for (var i = 0; i<retry; i++) {
    try {
      res = await func()
      break;
    } catch (e) {
      tryTimes += 1
      console.log('retry:' + tryTimes)
    }
  }
  return res
}

// getAllSkus S
const doRequest = (url) => () => {
  return new Promise((res, rej) => {
    var curl = `curl '${url}' ${HEADERS} --compressed`
    // console.log(curl)
    var child = child_process.exec(curl, {
      maxBuffer: 200 * 1024 * 10240,
    } , function(err, stdout, stderr) {
      if (err) {
        console.log('errerrerrerrerrerrerrerrerrerrerrerrerrerrerrerrerr-----------------')
        console.log(err)
        rej(err)
        return
      }

      // console.log(stdout)
      let data = null
      try {
        data = JSON.parse(stdout)
      } catch (e) {
        throw new Error('throw invalid_json')
        rej('invalid_json')
      }
      res(data)
    });
  })
}
// getAllSkus E

const getRealTimeStockBySku = async (sku) => {
  const headerIsValid = await getNewHeader()
  const url = 'https://aoavailability.nike.net/availability/v1/sales/9800/availability?productIds='+sku
  let res = await retryWrapper(doRequest(url))
  return res
}

const getInfoBySku = async (sku) => {
  // const headerIsValid = await getNewHeader()
  // const url = 'https://aoproduct.nike.net/products/v1/?childSo=9800&contracts=&currency=CNY&hzn=0&language=ZH&limit=400&priceList=CHINA&region=CHINA&sizeType=USA&so=9800&soldTo=0005067313&styleColor='+sku
  try {
    let res = await client.get('nikeweb_skuStockInfo:'+sku)
    return JSON.parse(res)
  } catch (e) {
    return []
  }
}

// const getInfoBySku = async (sku) => {
//   const headerIsValid = await getNewHeader()
//   const url = 'https://aoproduct.nike.net/products/v1/?childSo=9800&contracts=&currency=CNY&hzn=0&language=ZH&limit=400&priceList=CHINA&region=CHINA&sizeType=USA&so=9800&soldTo=0005067313&styleColor='+sku
//   let res = await retryWrapper(doRequest(url))
//   return res
// }

exports.getRealTimeStockBySku = getRealTimeStockBySku
exports.getInfoBySku = getInfoBySku


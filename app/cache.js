
const cache = {

}

//判断文件或者文件夹是否存在
function get(key){
  return cache[key] || 'undefined'
}

//列出文件夹下所有文件
function set(key, value){
  cache[key] = value
}

exports = {
    get,
    set,
}
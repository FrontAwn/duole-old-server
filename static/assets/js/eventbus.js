/**
 * 事件监听和发布
 * @providesModule BizEventBus
 * @method register
 * register 的参数是view,component或其他实例，只需要包含eventNames，即可在相应事件发生时触发相关回调
 * 
    let testEventListener = new class{
      
      eventbusKeys = ['A','B','C'];

      event_A(data) {
        console.log('obj:test got event A:'+ JSON.stringify(data) )
      }
      event_B(data) {
        console.log('obj:test got event B:'+ JSON.stringify(data) )
      }
      event_C(data) {
        console.log('obj:test got event C:'+ JSON.stringify(data) )
      }
    }
 * 
 * @method unregister
 * unregister 的参数是view,component或其他实例
 
 * @method post
 * string 第一个是消息类型，
 * any 第二个 参数可以是任意值类型，承载消息的内容
 */
const bus = {};

export default new class {

  register(obj) {
    var self = this
    //获取当前对象需要关注的消息
    let events = obj.eventbusKeys;
    if(events){
      events.forEach((eventName)=>{
        self._initEvent(eventName,obj)
      })
    }
  }

  unregister(obj,eventName) {
    var self = this
    if(eventName){
      this._rmListening(eventName,obj);
    }else{
      for(let eventName in bus){
        let eventMap = bus[eventName]
        if(eventMap.has(obj)){
          self._rmListening(eventName,obj)
        }
      }
    }
  }

  post(eventName, eventData) {
    if(bus[eventName]){
      for (let obj of bus[eventName].keys()) {
        if(obj['event_'+eventName]) obj['event_'+eventName].call(obj,eventData);
      }
    }
  }

  _rmListening(eventName, obj) {
      bus[eventName].delete(obj);
      if(bus[eventName].size==0) {
        bus[eventName]=null;
        delete bus[eventName];
      }
  }

  _initEvent(eventName,obj) {
    if(!bus[eventName]) bus[eventName] = new Map();
    if(!bus[eventName].has(obj)){
      bus[eventName].set(obj);
    }
  }

};

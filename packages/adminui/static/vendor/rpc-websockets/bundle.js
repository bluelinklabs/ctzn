/*! (C) WebReflection Mit Style License */
var CircularJSON=function(JSON,RegExp){var specialChar="~",safeSpecialChar="\\x"+("0"+specialChar.charCodeAt(0).toString(16)).slice(-2),escapedSafeSpecialChar="\\"+safeSpecialChar,specialCharRG=new RegExp(safeSpecialChar,"g"),safeSpecialCharRG=new RegExp(escapedSafeSpecialChar,"g"),safeStartWithSpecialCharRG=new RegExp("(?:^|([^\\\\]))"+escapedSafeSpecialChar),indexOf=[].indexOf||function(v){for(var i=this.length;i--&&this[i]!==v;);return i},$String=String;function generateReplacer(value,replacer,resolve){var doNotIgnore=false,inspect=!!replacer,path=[],all=[value],seen=[value],mapp=[resolve?specialChar:"[Circular]"],last=value,lvl=1,i,fn;if(inspect){fn=typeof replacer==="object"?function(key,value){return key!==""&&replacer.indexOf(key)<0?void 0:value}:replacer}return function(key,value){if(inspect)value=fn.call(this,key,value);if(doNotIgnore){if(last!==this){i=lvl-indexOf.call(all,this)-1;lvl-=i;all.splice(lvl,all.length);path.splice(lvl-1,path.length);last=this}if(typeof value==="object"&&value){if(indexOf.call(all,value)<0){all.push(last=value)}lvl=all.length;i=indexOf.call(seen,value);if(i<0){i=seen.push(value)-1;if(resolve){path.push((""+key).replace(specialCharRG,safeSpecialChar));mapp[i]=specialChar+path.join(specialChar)}else{mapp[i]=mapp[0]}}else{value=mapp[i]}}else{if(typeof value==="string"&&resolve){value=value.replace(safeSpecialChar,escapedSafeSpecialChar).replace(specialChar,safeSpecialChar)}}}else{doNotIgnore=true}return value}}function retrieveFromPath(current,keys){for(var i=0,length=keys.length;i<length;current=current[keys[i++].replace(safeSpecialCharRG,specialChar)]);return current}function generateReviver(reviver){return function(key,value){var isString=typeof value==="string";if(isString&&value.charAt(0)===specialChar){return new $String(value.slice(1))}if(key==="")value=regenerate(value,value,{});if(isString)value=value.replace(safeStartWithSpecialCharRG,"$1"+specialChar).replace(escapedSafeSpecialChar,safeSpecialChar);return reviver?reviver.call(this,key,value):value}}function regenerateArray(root,current,retrieve){for(var i=0,length=current.length;i<length;i++){current[i]=regenerate(root,current[i],retrieve)}return current}function regenerateObject(root,current,retrieve){for(var key in current){if(current.hasOwnProperty(key)){current[key]=regenerate(root,current[key],retrieve)}}return current}function regenerate(root,current,retrieve){return current instanceof Array?regenerateArray(root,current,retrieve):current instanceof $String?current.length?retrieve.hasOwnProperty(current)?retrieve[current]:retrieve[current]=retrieveFromPath(root,current.split(specialChar)):root:current instanceof Object?regenerateObject(root,current,retrieve):current}var CircularJSON={stringify:function stringify(value,replacer,space,doNotResolve){return CircularJSON.parser.stringify(value,generateReplacer(value,replacer,!doNotResolve),space)},parse:function parse(text,reviver){return CircularJSON.parser.parse(text,generateReviver(reviver))},parser:JSON};return CircularJSON}(JSON,RegExp);

var has = Object.prototype.hasOwnProperty
, prefix = '~';

/**
* Constructor to create a storage for our `EE` objects.
* An `Events` instance is a plain object whose properties are event names.
*
* @constructor
* @private
*/
function Events() {}

//
// We try to not inherit from `Object.prototype`. In some engines creating an
// instance in this way is faster than calling `Object.create(null)` directly.
// If `Object.create(null)` is not supported we prefix the event names with a
// character to make sure that the built-in object properties are not
// overridden or used as an attack vector.
//
if (Object.create) {
Events.prototype = Object.create(null);

//
// This hack is needed because the `__proto__` property is still inherited in
// some old browsers like Android 4, iPhone 5.1, Opera 11 and Safari 5.
//
if (!new Events().__proto__) prefix = false;
}

/**
* Representation of a single event listener.
*
* @param {Function} fn The listener function.
* @param {*} context The context to invoke the listener with.
* @param {Boolean} [once=false] Specify if the listener is a one-time listener.
* @constructor
* @private
*/
function EE(fn, context, once) {
this.fn = fn;
this.context = context;
this.once = once || false;
}

/**
* Add a listener for a given event.
*
* @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
* @param {(String|Symbol)} event The event name.
* @param {Function} fn The listener function.
* @param {*} context The context to invoke the listener with.
* @param {Boolean} once Specify if the listener is a one-time listener.
* @returns {EventEmitter}
* @private
*/
function addListener(emitter, event, fn, context, once) {
if (typeof fn !== 'function') {
  throw new TypeError('The listener must be a function');
}

var listener = new EE(fn, context || emitter, once)
  , evt = prefix ? prefix + event : event;

if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
else emitter._events[evt] = [emitter._events[evt], listener];

return emitter;
}

/**
* Clear event by name.
*
* @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
* @param {(String|Symbol)} evt The Event name.
* @private
*/
function clearEvent(emitter, evt) {
if (--emitter._eventsCount === 0) emitter._events = new Events();
else delete emitter._events[evt];
}

/**
* Minimal `EventEmitter` interface that is molded against the Node.js
* `EventEmitter` interface.
*
* @constructor
* @public
*/
function EventEmitter() {
this._events = new Events();
this._eventsCount = 0;
}

/**
* Return an array listing the events for which the emitter has registered
* listeners.
*
* @returns {Array}
* @public
*/
EventEmitter.prototype.eventNames = function eventNames() {
var names = []
  , events
  , name;

if (this._eventsCount === 0) return names;

for (name in (events = this._events)) {
  if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
}

if (Object.getOwnPropertySymbols) {
  return names.concat(Object.getOwnPropertySymbols(events));
}

return names;
};

/**
* Return the listeners registered for a given event.
*
* @param {(String|Symbol)} event The event name.
* @returns {Array} The registered listeners.
* @public
*/
EventEmitter.prototype.listeners = function listeners(event) {
var evt = prefix ? prefix + event : event
  , handlers = this._events[evt];

if (!handlers) return [];
if (handlers.fn) return [handlers.fn];

for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
  ee[i] = handlers[i].fn;
}

return ee;
};

/**
* Return the number of listeners listening to a given event.
*
* @param {(String|Symbol)} event The event name.
* @returns {Number} The number of listeners.
* @public
*/
EventEmitter.prototype.listenerCount = function listenerCount(event) {
var evt = prefix ? prefix + event : event
  , listeners = this._events[evt];

if (!listeners) return 0;
if (listeners.fn) return 1;
return listeners.length;
};

/**
* Calls each of the listeners registered for a given event.
*
* @param {(String|Symbol)} event The event name.
* @returns {Boolean} `true` if the event had listeners, else `false`.
* @public
*/
EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
var evt = prefix ? prefix + event : event;

if (!this._events[evt]) return false;

var listeners = this._events[evt]
  , len = arguments.length
  , args
  , i;

if (listeners.fn) {
  if (listeners.once) this.removeListener(event, listeners.fn, undefined, true);

  switch (len) {
    case 1: return listeners.fn.call(listeners.context), true;
    case 2: return listeners.fn.call(listeners.context, a1), true;
    case 3: return listeners.fn.call(listeners.context, a1, a2), true;
    case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
    case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
    case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
  }

  for (i = 1, args = new Array(len -1); i < len; i++) {
    args[i - 1] = arguments[i];
  }

  listeners.fn.apply(listeners.context, args);
} else {
  var length = listeners.length
    , j;

  for (i = 0; i < length; i++) {
    if (listeners[i].once) this.removeListener(event, listeners[i].fn, undefined, true);

    switch (len) {
      case 1: listeners[i].fn.call(listeners[i].context); break;
      case 2: listeners[i].fn.call(listeners[i].context, a1); break;
      case 3: listeners[i].fn.call(listeners[i].context, a1, a2); break;
      case 4: listeners[i].fn.call(listeners[i].context, a1, a2, a3); break;
      default:
        if (!args) for (j = 1, args = new Array(len -1); j < len; j++) {
          args[j - 1] = arguments[j];
        }

        listeners[i].fn.apply(listeners[i].context, args);
    }
  }
}

return true;
};

/**
* Add a listener for a given event.
*
* @param {(String|Symbol)} event The event name.
* @param {Function} fn The listener function.
* @param {*} [context=this] The context to invoke the listener with.
* @returns {EventEmitter} `this`.
* @public
*/
EventEmitter.prototype.on = function on(event, fn, context) {
return addListener(this, event, fn, context, false);
};

/**
* Add a one-time listener for a given event.
*
* @param {(String|Symbol)} event The event name.
* @param {Function} fn The listener function.
* @param {*} [context=this] The context to invoke the listener with.
* @returns {EventEmitter} `this`.
* @public
*/
EventEmitter.prototype.once = function once(event, fn, context) {
return addListener(this, event, fn, context, true);
};

/**
* Remove the listeners of a given event.
*
* @param {(String|Symbol)} event The event name.
* @param {Function} fn Only remove the listeners that match this function.
* @param {*} context Only remove the listeners that have this context.
* @param {Boolean} once Only remove one-time listeners.
* @returns {EventEmitter} `this`.
* @public
*/
EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
var evt = prefix ? prefix + event : event;

if (!this._events[evt]) return this;
if (!fn) {
  clearEvent(this, evt);
  return this;
}

var listeners = this._events[evt];

if (listeners.fn) {
  if (
    listeners.fn === fn &&
    (!once || listeners.once) &&
    (!context || listeners.context === context)
  ) {
    clearEvent(this, evt);
  }
} else {
  for (var i = 0, events = [], length = listeners.length; i < length; i++) {
    if (
      listeners[i].fn !== fn ||
      (once && !listeners[i].once) ||
      (context && listeners[i].context !== context)
    ) {
      events.push(listeners[i]);
    }
  }

  //
  // Reset the array, or remove it completely if we have no more listeners.
  //
  if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
  else clearEvent(this, evt);
}

return this;
};

/**
* Remove all listeners, or those of the specified event.
*
* @param {(String|Symbol)} [event] The event name.
* @returns {EventEmitter} `this`.
* @public
*/
EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
var evt;

if (event) {
  evt = prefix ? prefix + event : event;
  if (this._events[evt]) clearEvent(this, evt);
} else {
  this._events = new Events();
  this._eventsCount = 0;
}

return this;
};

//
// Alias methods names because people roll like that.
//
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;

//
// Expose the prefix.
//
EventEmitter.prefixed = prefix;

//
// Allow `EventEmitter` to be imported as module namespace.
//
EventEmitter.EventEmitter = EventEmitter;

/**
 * WebSocket implements a browser-side WebSocket specification.
 * @module Client
 */
class WebSocketBrowserImpl extends EventEmitter {
    /** Instantiate a WebSocket class
     * @constructor
     * @param {String} address - url to a websocket server
     * @param {(Object)} options - websocket options
     * @param {(String|Array)} protocols - a list of protocols
     * @return {WebSocketBrowserImpl} - returns a WebSocket instance
     */
    constructor(address, options, protocols) {
        super();
        this.socket = new window.WebSocket(address, protocols);
        this.socket.onopen = () => this.emit("open");
        this.socket.onmessage = (event) => this.emit("message", event.data);
        this.socket.onerror = (error) => this.emit("error", error);
        this.socket.onclose = (event) => {
            this.emit("close", event.code, event.reason);
        };
    }
    /**
     * Sends data through a websocket connection
     * @method
     * @param {(String|Object)} data - data to be sent via websocket
     * @param {Object} optionsOrCallback - ws options
     * @param {Function} callback - a callback called once the data is sent
     * @return {Undefined}
     */
    send(data, optionsOrCallback, callback) {
        const cb = callback || optionsOrCallback;
        try {
            this.socket.send(data);
            cb();
        }
        catch (error) {
            cb(error);
        }
    }
    /**
     * Closes an underlying socket
     * @method
     * @param {Number} code - status code explaining why the connection is being closed
     * @param {String} reason - a description why the connection is closing
     * @return {Undefined}
     * @throws {Error}
     */
    close(code, reason) {
        this.socket.close(code, reason);
    }
    addEventListener(type, listener, options) {
        this.socket.addEventListener(type, listener, options);
    }
}
/**
 * factory method for common WebSocket instance
 * @method
 * @param {String} address - url to a websocket server
 * @param {(Object)} options - websocket options
 * @return {Undefined}
 */
function WebSocketBrowserImpl$1 (address, options) {
    return new WebSocketBrowserImpl(address, options);
}

/**
 * "Client" wraps "ws" or a browser-implemented "WebSocket" library
 * according to the environment providing JSON RPC 2.0 support on top.
 * @module Client
 */
class CommonClient extends EventEmitter {
    /**
     * Instantiate a Client class.
     * @constructor
     * @param {webSocketFactory} webSocketFactory - factory method for WebSocket
     * @param {String} address - url to a websocket server
     * @param {Object} options - ws options object with reconnect parameters
     * @param {Function} generate_request_id - custom generation request Id
     * @return {CommonClient}
     */
    constructor(webSocketFactory, address = "ws://localhost:8080", { autoconnect = true, reconnect = true, reconnect_interval = 1000, max_reconnects = 5 } = {}, generate_request_id) {
        super();
        this.webSocketFactory = webSocketFactory;
        this.queue = {};
        this.rpc_id = 0;
        this.address = address;
        this.autoconnect = autoconnect;
        this.ready = false;
        this.reconnect = reconnect;
        this.reconnect_interval = reconnect_interval;
        this.max_reconnects = max_reconnects;
        this.current_reconnects = 0;
        this.generate_request_id = generate_request_id || (() => ++this.rpc_id);
        if (this.autoconnect)
            this._connect(this.address, {
                autoconnect: this.autoconnect,
                reconnect: this.reconnect,
                reconnect_interval: this.reconnect_interval,
                max_reconnects: this.max_reconnects
            });
    }
    /**
     * Connects to a defined server if not connected already.
     * @method
     * @return {Undefined}
     */
    connect() {
        if (this.socket)
            return;
        this._connect(this.address, {
            autoconnect: this.autoconnect,
            reconnect: this.reconnect,
            reconnect_interval: this.reconnect_interval,
            max_reconnects: this.max_reconnects
        });
    }
    /**
     * Calls a registered RPC method on server.
     * @method
     * @param {String} method - RPC method name
     * @param {Object|Array} params - optional method parameters
     * @param {Number} timeout - RPC reply timeout value
     * @param {Object} ws_opts - options passed to ws
     * @return {Promise}
     */
    call(method, params, timeout, ws_opts) {
        if (!ws_opts && "object" === typeof timeout) {
            ws_opts = timeout;
            timeout = null;
        }
        return new Promise((resolve, reject) => {
            if (!this.ready)
                return reject(new Error("socket not ready"));
            const rpc_id = this.generate_request_id(method, params);
            const message = {
                jsonrpc: "2.0",
                method: method,
                params: params || null,
                id: rpc_id
            };
            this.socket.send(JSON.stringify(message), ws_opts, (error) => {
                if (error)
                    return reject(error);
                this.queue[rpc_id] = { promise: [resolve, reject] };
                if (timeout) {
                    this.queue[rpc_id].timeout = setTimeout(() => {
                        this.queue[rpc_id] = null;
                        reject(new Error("reply timeout"));
                    }, timeout);
                }
            });
        });
    }
    /**
     * Logins with the other side of the connection.
     * @method
     * @param {Object} params - Login credentials object
     * @return {Promise}
     */
    async login(params) {
        const resp = await this.call("rpc.login", params);
        if (!resp)
            throw new Error("authentication failed");
    }
    /**
     * Fetches a list of client's methods registered on server.
     * @method
     * @return {Array}
     */
    async listMethods() {
        return await this.call("__listMethods");
    }
    /**
     * Sends a JSON-RPC 2.0 notification to server.
     * @method
     * @param {String} method - RPC method name
     * @param {Object} params - optional method parameters
     * @return {Promise}
     */
    notify(method, params) {
        return new Promise((resolve, reject) => {
            if (!this.ready)
                return reject(new Error("socket not ready"));
            const message = {
                jsonrpc: "2.0",
                method: method,
                params: params || null
            };
            this.socket.send(JSON.stringify(message), (error) => {
                if (error)
                    return reject(error);
                resolve();
            });
        });
    }
    /**
     * Subscribes for a defined event.
     * @method
     * @param {String|Array} event - event name
     * @return {Undefined}
     * @throws {Error}
     */
    async subscribe(event) {
        if (typeof event === "string")
            event = [event];
        const result = await this.call("rpc.on", event);
        if (typeof event === "string" && result[event] !== "ok")
            throw new Error("Failed subscribing to an event '" + event + "' with: " + result[event]);
        return result;
    }
    /**
     * Unsubscribes from a defined event.
     * @method
     * @param {String|Array} event - event name
     * @return {Undefined}
     * @throws {Error}
     */
    async unsubscribe(event) {
        if (typeof event === "string")
            event = [event];
        const result = await this.call("rpc.off", event);
        if (typeof event === "string" && result[event] !== "ok")
            throw new Error("Failed unsubscribing from an event with: " + result);
        return result;
    }
    /**
     * Closes a WebSocket connection gracefully.
     * @method
     * @param {Number} code - socket close code
     * @param {String} data - optional data to be sent before closing
     * @return {Undefined}
     */
    close(code, data) {
        this.socket.close(code || 1000, data);
    }
    /**
     * Connection/Message handler.
     * @method
     * @private
     * @param {String} address - WebSocket API address
     * @param {Object} options - ws options object
     * @return {Undefined}
     */
    _connect(address, options) {
        this.socket = this.webSocketFactory(address, options);
        this.socket.addEventListener("open", () => {
            this.ready = true;
            this.emit("open");
            this.current_reconnects = 0;
        });
        this.socket.addEventListener("message", ({ data: message }) => {
            if (message instanceof ArrayBuffer)
                message = Buffer.from(message).toString();
            try {
                message = CircularJSON.parse(message);
            }
            catch (error) {
                return;
            }
            // check if any listeners are attached and forward event
            if (message.notification && this.listeners(message.notification).length) {
                if (!Object.keys(message.params).length)
                    return this.emit(message.notification);
                const args = [message.notification];
                if (message.params.constructor === Object)
                    args.push(message.params);
                else
                    // using for-loop instead of unshift/spread because performance is better
                    for (let i = 0; i < message.params.length; i++)
                        args.push(message.params[i]);
                // run as microtask so that pending queue messages are resolved first
                // eslint-disable-next-line prefer-spread
                return Promise.resolve().then(() => { this.emit.apply(this, args); });
            }
            if (!this.queue[message.id]) {
                // general JSON RPC 2.0 events
                if (message.method && message.params) {
                    // run as microtask so that pending queue messages are resolved first
                    return Promise.resolve().then(() => {
                        this.emit(message.method, message.params);
                    });
                }
                return;
            }
            // reject early since server's response is invalid
            if ("error" in message === "result" in message)
                this.queue[message.id].promise[1](new Error("Server response malformed. Response must include either \"result\"" +
                    " or \"error\", but not both."));
            if (this.queue[message.id].timeout)
                clearTimeout(this.queue[message.id].timeout);
            if (message.error)
                this.queue[message.id].promise[1](message.error);
            else
                this.queue[message.id].promise[0](message.result);
            this.queue[message.id] = null;
        });
        this.socket.addEventListener("error", (error) => this.emit("error", error));
        this.socket.addEventListener("close", ({ code, reason }) => {
            if (this.ready) // Delay close event until internal state is updated
                setTimeout(() => this.emit("close", code, reason), 0);
            this.ready = false;
            this.socket = undefined;
            if (code === 1000)
                return;
            this.current_reconnects++;
            if (this.reconnect && ((this.max_reconnects > this.current_reconnects) ||
                this.max_reconnects === 0))
                setTimeout(() => this._connect(address, options), this.reconnect_interval);
        });
    }
}

class Client extends CommonClient {
    constructor(address = "ws://localhost:8080", { autoconnect = true, reconnect = true, reconnect_interval = 1000, max_reconnects = 5 } = {}, generate_request_id) {
        super(WebSocketBrowserImpl$1, address, {
            autoconnect,
            reconnect,
            reconnect_interval,
            max_reconnects
        }, generate_request_id);
    }
}

export { Client };

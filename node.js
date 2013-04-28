define(["heya-has/sniff", "heya-dom/dom", "heya-events/EventSource"],
	function(has, dom, EventSource){
	"use strict";

	has.add("event-orientationchange", has("touch") && !has("android")); // TODO: how do we detect this?
	has.add("event-stopimmediatepropagation", window.Event && !!window.Event.prototype && !!window.Event.prototype.stopImmediatePropagation);
	has.add("event-focusin", function(global, doc, element){
		// All browsers except firefox support focusin, but too hard to feature test webkit since element.onfocusin
		// is undefined.  Just return true for IE and use fallback path for other browsers.
		return !!element.attachEvent;
	});

	if(!has("event-stopimmediatepropagation")){
		var stopImmediatePropagation =function(){
			this.immediatelyStopped = true;
			this.modified = true; // mark it as modified so the event will be cached in IE
		};
		var addStopImmediate = function(listener){
			return function(evt){
				if(!evt.immediatelyStopped){// check to make sure it hasn't been stopped immediately
					evt.stopImmediatePropagation = stopImmediatePropagation;
					return listener.apply(this, arguments);
				}
			};
		}
	}

	var touchEvents = /^touch/, captures = {focusin: "focus", focusout: "blur"};

	function NodeEvents(source, type){
		EventSource.call(this);
		this.source = dom.byId(source);
		this.type = type;
		this._attach();
	}
	NodeEvents.prototype = Object.create(EventSource.prototype);

	NodeEvents.prototype.destroy =
	NodeEvents.prototype.remove =
	NodeEvents.prototype.release = function release(){
		this._remove();
		EventSource.prototype.release.call(this);
	};

	NodeEvents.prototype._attach = function(){
		var source = this.source, type = this.type, listener = _listener, capture = false;
		// test to see if it a touch event right now, so we don't have to do it every time it fires
		if(has("touch")){
			if(touchEvents.test(type)){
				// touch event, fix it
				listener = _touchListener;
			}else if(!has("event-orientationchange") && (type == "orientationchange")){
				//"orientationchange" not supported <= Android 2.1,
				//but works through "resize" on window
				type = "resize";
				source = window;
				listener = _touchListener;
			}
		}
		if(addStopImmediate){
			// add stopImmediatePropagation if it doesn't exist
			listener = addStopImmediate(listener);
		}
		// the source has addEventListener, which should be used if available (might or might not be a node, non-nodes can implement this method as well)
		// check for capture conversions
		if(!has("event-focusin") && captures[type]){
			type = captures[type];
			capture = true;
		}
		listener = listener.bind(this);
		source.addEventListener(type, listener, capture);
		this._remove = function(){
			source.removeEventListener(adjustedType, listener, capture);
		};
	};

	NodeEvents.prototype._listener = function(evt){
		this.micro.send(new EventSource.Value(evt));
	};

	var windowOrientation = window.orientation;

	function PseudoEvent(){}

	NodeEvents.prototype._touchListener = function(evt){
		//Event normalization(for ontouchxxx and resize):
		//1.incorrect e.pageX|pageY in iOS
		//2.there are no "e.rotation", "e.scale" and "onorientationchange" in Android
		//3.More TBD e.g. force | screenX | screenX | clientX | clientY | radiusX | radiusY

		// see if it has already been corrected
		if(evt.corrected){
			evt = evt.corrected;
		}else{
			var type = evt.type, newEvt;
			try{
				delete evt.type; // on some JS engines (android), deleting properties make them mutable
			}catch(e){}
			if(evt.type){
				// deleting properties doesn't work (older iOS), have to use delegation
				if(has("mozilla")){
					// Firefox doesn't like delegated properties, so we have to copy
					newEvt = {};
					for(var name in evt){
						newEvt[name] = evt[name];
					}
				}else{
					// old iOS branch
					PseudoEvent.prototype = evt;
					newEvt = new PseudoEvent;
				}
				// have to delegate methods to make them work
				newEvt.preventDefault = function(){
					evt.preventDefault();
				};
				newEvt.stopPropagation = function(){
					evt.stopPropagation();
				};
			}else{
				// deletion worked, use property as is
				newEvt = evt;
				newEvt.type = type;
			}
			evt.corrected = newEvt;
			if(type == "resize"){
				if(windowOrientation === window.orientation){
					return; //double tap causes an unexpected 'resize' in Android
				}
				windowOrientation = window.orientation;
				newEvt.type = "orientationchange";
			}else{
				// We use the original event and augment, rather than doing an expensive mixin operation
				if(!("rotation" in newEvt)){ // test to see if it has rotation
					newEvt.rotation = 0;
					newEvt.scale = 1;
				}
				//use newEvt.changedTouches[0].pageX|pageY|screenX|screenY|clientX|clientY|target
				var firstChangeTouch = newEvt.changedTouches[0];
				for(var i in firstChangeTouch){ // use for-in, we don't need to have dependency on dojo/_base/lang here
					delete newEvt[i]; // delete it first to make it mutable
					newEvt[i] = firstChangeTouch[i];
				}
			}
			evt = newEvt;
		}

		this.micro.send(new EventSource.Value(evt));
	};

	return NodeEvents;
});

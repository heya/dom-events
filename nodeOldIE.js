define(["heya-has/sniff", "heya-dom/dom", "heya-events/EventSource"],
	function(has, dom, EventSource){

	var major = window.ScriptEngineMajorVersion;
	has.add("jscript", major && (major() + ScriptEngineMinorVersion() / 10));

	has.add("event-orientationchange", has("touch") && !has("android")); // TODO: how do we detect this?
	has.add("event-stopimmediatepropagation", window.Event && !!window.Event.prototype && !!window.Event.prototype.stopImmediatePropagation);
	has.add("event-focusin", function(global, doc, element){
		// All browsers except firefox support focusin, but too hard to feature test webkit since element.onfocusin
		// is undefined.  Just return true for IE and use fallback path for other browsers.
		return !!element.attachEvent;
	});

	function NodeEvents(source, type){
		EventSource.call(this);
		this.source = dom.byId(source);
		this.type = type;
		this._remove = this._attach("on" + type);
	}
	NodeEvents.prototype = Object.create(EventSource.prototype);

	NodeEvents.prototype.destroy =
	NodeEvents.prototype.remove =
	NodeEvents.prototype.release = function release(){
		this._remove();
		EventSource.prototype.release.call(this);
	};

	NodeEvents.prototype._attach = function(type){
		var source = this.source, capture = false;
		// touch events are removed because old IE do not support them
		// IE will leak memory on certain handlers in frames (IE8 and earlier) and in unattached DOM nodes for JScript 5.7 and below.
		// Here we use global redirection to solve the memory leaks
		if(typeof _dojoIEListeners_ == "undefined"){
			_dojoIEListeners_ = [];
		}
		var emitter = source[type];
		if(!emitter || !emitter.listeners){
			var oldListener = emitter;
			emitter = Function("event", "var callee = arguments.callee; for(var i = 0; i < callee.listeners.length; ++i){ var listener = _dojoIEListeners_[callee.listeners[i]]; if(listener){ listener.call(this, event); } }");
			emitter.listeners = [];
			source[type] = emitter;
			emitter._dojoIEListeners_ = _dojoIEListeners_;
			if(oldListener){
				emitter.listeners.push(_dojoIEListeners_.push(oldListener) - 1);
			}
		}
		var handle;
		emitter.listeners.push(handle = (emitter._dojoIEListeners_.push(listener) - 1));
		return function(){
			delete _dojoIEListeners_[handle];
		};
	};

	// utilities

	var lastEvent;	//TODO: why do we even need it?

	function listener(evt){
		if(!evt){
			evt = (window && (window.ownerDocument || window.document ||
				window).parentWindow || window).event;
		}
		if(evt){
			if(evt.immediatelyStopped){
				return;
			}
			evt.stopImmediatePropagation = stopImmediatePropagation;
			try{
				if(lastEvent && evt.type === lastEvent.type  && evt.srcElement === lastEvent.target){
					// should be same event, reuse event object (so it can be augmented);
					// accessing evt.srcElement rather than evt.target since evt.target not set on IE until fixup below
					evt = lastEvent;
				}
			}catch(e){
				// will occur on IE on lastEvent.type reference if lastEvent points to a previous event that already
				// finished bubbling, but the setTimeout() to clear lastEvent hasn't fired yet
			}
			if(!evt.target){ // check to see if it has been fixed yet
				evt.target = evt.srcElement;
				evt.currentTarget = (window || evt.srcElement);
				if(evt.type == "mouseover"){
					evt.relatedTarget = evt.fromElement;
				}
				if(evt.type == "mouseout"){
					evt.relatedTarget = evt.toElement;
				}
				if(!evt.stopPropagation){
					evt.stopPropagation = stopPropagation;
					evt.preventDefault = preventDefault;
				}
				if(evt.type === "keypress"){
					var c = "charCode" in evt ? evt.charCode : evt.keyCode;
					switch(c){
						case 10:
							// CTRL-ENTER is CTRL-ASCII(10) on IE,
							// but CTRL-ENTER on Mozilla
							c = 0;
							evt.keyCode = 13;
							break;
						case 13:
						case 27:
							// Mozilla considers ENTER and ESC non-printable
							c = 0;
							break;
						case 3:
							// Mozilla maps CTRL-BREAK to CTRL-c
							c = 99;
							break;
					}
					// Mozilla sets keyCode to 0 when there is a charCode
					// but that stops the event on IE.
					evt.charCode = c;
					setKeyChar(evt);
				}
			}
		}
		this.micro.send(new EventSource.Value(evt));
		// a hack to capture the last event
		if(evt.modified){
			// cache the last event and reuse it if we can
			if(!lastEvent){
				setTimeout(function(){ lastEvent = null; }, 0); // ha-ha
			}
			lastEvent = evt;
		}
	}

	function setKeyChar(evt){
		evt.keyChar = evt.charCode ? String.fromCharCode(evt.charCode) : "";
		evt.charOrCode = evt.keyChar || evt.keyCode;
	}

	function stopPropagation(){
		this.cancelBubble = true;
	}

	function stopImmediatePropagation(){
		this.immediatelyStopped = true;
		this.modified = true; // mark it as modified so the event will be cached in IE
	}

	function preventDefault(){
		// Setting keyCode to 0 is the only way to prevent certain keypresses (namely
		// ctrl-combinations that correspond to menu accelerator keys).
		// Otoh, it prevents upstream listeners from getting this information
		// Try to split the difference here by clobbering keyCode only for ctrl
		// combinations. If you still need to access the key upstream, bubbledKeyCode is
		// provided as a workaround.
		this.bubbledKeyCode = this.keyCode;
		if(this.ctrlKey){
			try{
				// squelch errors when keyCode is read-only
				// (e.g. if keyCode is ctrl or shift)
				this.keyCode = 0;
			}catch(e){}
		}
		this.defaultPrevented = true;
		this.returnValue = false;
		this.modified = true; // mark it as modified (for defaultPrevented flag) so the event will be cached in IE
	};

	return NodeEvents;
});

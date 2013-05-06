define(["heya-has/sniff", "heya-dom/dom"], function(has, dom){

	// It is probably better to use fireEvent(),
	// but given that it is non-standard, and supported
	// only by IE < 9, we'll let it slide.

	return function emit(target, evt){
		var args = slice.call(arguments, 2);
		var method = "on" + evt.type;
		if("parentNode" in target){
			// node (or node-like), create event controller methods
			var newEvent = args[0] = {};
			for(var i in evt){
				newEvent[i] = evt[i];
			}
			newEvent.preventDefault = syntheticPreventDefault;
			newEvent.stopPropagation = syntheticStopPropagation;
			newEvent.target = target;
			evt = newEvent;
		}
		do{
			// call any node which has a handler (note that ideally we would try/catch to simulate normal event propagation but that causes too much pain for debugging)
			target[method] && target[method].apply(target, args);
			// and then continue up the parent node chain if it is still bubbling (if started as bubbles and stopPropagation hasn't been called)
		}while(evt && evt.bubbles && (target = target.parentNode));
		return evt && evt.cancelable && evt; // if it is still true (was cancelable and was cancelled), return the event to indicate default action should happen
	};

	function syntheticPreventDefault(){
		this.cancelable = false;
		this.defaultPrevented = true;
	}

	function syntheticStopPropagation(){
		this.bubbles = false;
	}
});

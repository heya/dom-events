define(["heya-has/sniff", "heya-dom/dom"], function(has, dom){
	"use strict";

	//TODO: the algorithm below is depricated,
	// MDN suggests to use event constructors

	return function emit(target, type, evt){
		// use the native event emitting mechanism if it is available on the target object
		// create a generic event
		// we could create branch into the different types of event constructors, but
		// that would be a lot of extra code, with little benefit that I can see, seems
		// best to use the generic constructor and copy properties over, making it
		// easy to have events look like the ones created with specific initializers
		var nativeEvent = target.ownerDocument.createEvent("HTMLEvents");
		nativeEvent.initEvent(type, !!evt.bubbles, !!evt.cancelable);
		// and copy all our properties over
		for(var name in evt){
			if(!(name in nativeEvent)){
				nativeEvent[name] = evt[name];
			}
		}
		return target.dispatchEvent(nativeEvent) && nativeEvent;
	};
});

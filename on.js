define(["./node", "heya-events/EventSource"], function(NodeEvents){
	"use strict";

	return function on(node, type, filter){
		if(typeof type == "function"){
			return type(node);
		}
		if(type instanceof Array){
			var merger = new NodeEvents(null, null, filter),
				sources = type.map(function(type){
					var source = on(node, type);
					source.on(function(evt){
						merger.dispatch(evt);
						return evt;
					});
					return source;
				});
			merger._removals.push(function(){
				sources.forEach(function(source){ source.remove(); });
				sources = null;
			});
			return merger;
		}
		return new NodeEvents(node, type, filter);
	};
});

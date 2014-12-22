/*
 *
 *
 *
 *	Response websocket
 *
 *
 *
 */




nodefony.register("wsResponse",function(){


	var Response = function(connection){
		this.connection = connection ;
		this.body = "";
	};

	
	Response.prototype.send = function(data){
		//console.log(data)
		this.connection.send(data);
		this.body = "";
	};


	return Response;

});

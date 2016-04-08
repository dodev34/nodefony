
nodefony.registerBundle ("monitoring", function(){

	/**
	 *	The class is a **`monitoring` BUNDLE** .
	 *	@module NODEFONY
	 *	@main NODEFONY
	 *	@class monitoring
	 *	@constructor
	 *	@param {class} kernel
	 *	@param {class} container
	 *	
	 */
	var monitoring = function(kernel, container){

		// load bundle library 
		//this.autoLoader.loadDirectory(this.path+"/core");

		this.mother = this.$super;
		this.mother.constructor(kernel, container);
			
		/*
		 *	If you want kernel wait monitoringBundle event <<onReady>> 
		 *
		 *      this.waitBundleReady = true ; 
		 */	
		
		this.infoKernel = {};
		this.infoBundles = {};
		this.storageProfiling = this.settings.storage.requests ;
		 
		this.kernel.listen(this, "onPreBoot", function(kernel){
			this.infoKernel["events"] = {} ;
			for(var event in kernel.notificationsCenter.event["_events"] ){
				switch (event){
					case "onPreBoot":
						this.infoKernel["events"][event] = {
							fire:kernel.preboot,
							nb:1,
							listeners:kernel.notificationsCenter.event["_events"][event].length
						} ;
					break;
					default:
						this.infoKernel["events"][event] = {
							fire:false,
							nb:0,
							listeners:kernel.notificationsCenter.event["_events"][event].length
						} ;
						kernel.listen(kernel ,event, function(){
							var ele =  arguments[0]  ;
							this.infoKernel["events"][ele].fire= true;
							this.infoKernel["events"][ele].nb = ++this.infoKernel["events"][ele].nb
						}.bind(this, event ) )	
				}
			}
		});

		this.kernel.listen(this, "onReady", function(kernel){
			var ormName = this.kernel.settings.orm ;
			this.orm = this.get(ormName);
			this.requestEntity = this.orm.getEntity("requests"); 
			
			for(var bund in kernel.bundles ){
				//console.log( kernel.bundles[bund] );
				this.infoBundles[bund] = {} ;
				this.infoBundles[bund]["waitBundleReady"] = kernel.bundles[bund].waitBundleReady
				this.infoBundles[bund]["version"] = kernel.bundles[bund].settings.version 
			}
			//console.log(this.infoBundles);
			for(var event in this.kernel.notificationsCenter.event["_events"] ){
				switch (event){
					case "onReady":
						this.infoKernel["events"][event] = {
							fire:kernel.ready,
							nb:0,
							listeners:this.kernel.notificationsCenter.event["_events"][event].length
						} ;
					break;
					default:
						this.infoKernel["events"][event] = nodefony.extend( true, this.infoKernel["events"][event],{
							listeners:this.kernel.notificationsCenter.event["_events"][event].length
						}) ;
				}
			}


			if ( this.container.getParameters("bundles."+this.name).debugBar) {
				this.logger("ADD DEBUG BAR MONITORING", "WARNING");
				this.bundles = function(){
					var obj = {};
					for (var bundle in this.kernel.bundles ){
						obj[bundle] = {
							name:this.kernel.bundles[bundle].name,
							version:this.kernel.bundles[bundle].settings.version
						}	
					}
					return obj;
				}.call(this);
				this.syslogContext = new nodefony.syslog({
					moduleName:"CONTEXT",
					maxStack: 50,
					defaultSeverity:"INFO"	
				}); 
				this.env = this.kernel.environment ;
				this.app = this.getParameters("bundles.App").App ;
				this.node = process.versions ;
				this.upload = this.container.get("upload");
				this.translation = this.container.get("translation");
				this.sessionService = this.container.get("sessions");
				this.domain =  this.translation.defaultDomain ;
				this.nbServices = Object.keys(nodefony.services).length ;
				

				//ORM
				//console.log(orm.connections.nodefony);
				var ORM = {} ;
				if (this.orm){
					ORM = {
						name:this.orm.name,
						version:this.orm.engine.version,
						connections:this.orm.connections
					}
				}

				this.service = {
					upload : {
						tmp_dir:this.upload.config.tmp_dir,
						max_size:this.upload.config.max_filesize
					},
					translation:{
						defaultLocale:this.translation.defaultLocale,
						defaultDomain: this.domain	
					},
					session:{
						storage:this.sessionService.settings.handler,
						path:this.sessionService.settings.save_path
					},
					ORM:ORM
				}; 
				this.security = function(){
					var obj = {};
					var firewall = this.container.get("security");
					if (firewall){
						for (var area in firewall.securedAreas ){
							//console.log(firewall.securedAreas[area])
							obj[area] = {};
							obj[area]["pattern"] = firewall.securedAreas[area].regPartten;
							obj[area]["factory"] = firewall.securedAreas[area].factory ? firewall.securedAreas[area].factory.name : null ;
							obj[area]["provider"] = firewall.securedAreas[area].provider ? firewall.securedAreas[area].provider.name : null ;
							obj[area]["context"] = firewall.securedAreas[area].sessionContext;
						}
					}
					return obj ; 
				}.call(this);	
			}
		}); 

		this.kernel.listen(this, "onServerRequest",function(request, response, logString, d){
			request.nodefony_time = new Date().getTime();	
		});

		this.kernel.listen(this, "onRequest",function(context){

			context.profiling = null ;

			if ( context.resolver.resolve ){
				var trans = context.get("translation");
				var obj = {
					bundle:context.resolver.bundle.name,
					bundles:this.bundles,
					pwd:process.env["PWD"],
					node:this.node,
					services:this.service,
					nbServices:this.nbServices,
					security:this.security,
					route:{
						name:context.resolver.route.name,
						uri:context.resolver.route.path,
						variables:context.resolver.variables,
						pattern:context.resolver.route.pattern.toString(),	
						defaultView:context.resolver.defaultView
					},
					varialblesName:context.resolver.route.variables,
					kernelSettings:this.kernel.settings,
					environment:this.env,
					debug:this.kernel.debug,
					appSettings:this.app,
					locale:{
						default:trans.defaultLocale,
						domain:trans.defaultDomain
					}
				};
				nodefony.extend(obj, context.extendTwig);

				obj["events"] = {} ;
				for(var event in context.notificationsCenter.event["_events"] ){
					if ( event == "onRequest"){
						obj["events"][event] = {
							fire:true,
							nb:1,
							listeners:context.notificationsCenter.event["_events"][event].length
						} ;
					}else{
						obj["events"][event] = {
							fire:false,
							nb:0,
							listeners:context.notificationsCenter.event["_events"][event].length
						} ;
					}
					//console.log(event)
					context.listen(context ,event, function(){
						var ele =  arguments[ 0]  ;
						obj["events"][ele].fire= true;
						obj["events"][ele].nb = ++obj["events"][ele].nb
					}.bind(context, event ) )	
				}

				if ( context.security ){
					var secu = context.session.getMetaBag("security");
					obj["context_secure"] = {
						name: context.security.name ,
						factory : context.security.factory.name,
						token:secu  ? secu.tokenName : context.security.factory.token,
						user:context.user
					}	
				}else{
					var secu = context.session ? context.session.getMetaBag("security") : null;
					if ( secu ){
						obj["context_secure"] = {
							name:	"OFF",
							factory : null,
							token:null,
							user:context.user
						}
					}else{
						obj["context_secure"] = null ;	
					}
				}
					
				if ( context.resolver.route.defaults ) {
					var tab = context.resolver.route.defaults.controller.split(":") ;
					var contr   =    ( tab[1] ? tab[1] : "default" );
					obj["routeur"] =  {
						bundle : context.resolver.bundle.name+"Bundle" ,
						action : tab[2]+"Action" ,
						pattern : context.resolver.route.defaults.controller ,
						Controller : contr+"Controller"
					}
					
				}
				if (context.proxy){
					obj["proxy"] = context.proxy ;
				}else{
					obj["proxy"] = null ;
				}

				if ( context.session ){
					obj["session"] = {
						name:context.session.name,
						id:context.session.id,
						metas:context.session.metaBag(),
						attributes:context.session.attributes(),
						flashes:context.session.flashBags(),
						context:context.session.contextSession
					};
				}
				
				if ( context.request.queryFile ){
					obj["queryFile"] = {};
					for (var ele in context.request.queryFile){
						obj["queryFile"][ele] = {
							path		: context.request.queryFile[ele].path,
							mimetype	: context.request.queryFile[ele].mimeType,
							length		: context.request.queryFile[ele].lenght,
							fileName	: context.request.queryFile[ele].fileName
						}
					}
				}
				obj["context"] = {
					type:context.type,	
					isAjax:context.isAjax,
					secureArea:context.secureArea,
					domain:context.domain,
					url:context.url,
					remoteAddress:context.remoteAddress,
					crossDomain:context.crossDomain
				}

				switch (context.type){
					case "HTTP":
					case "HTTPS":
						obj["timeStamp"] = context.request.request.nodefony_time ;
						switch (context.request.contentType){
							case "multipart/form-data":
								//console.log(context.request.queryFile)
								try{
									var content = JSON.stringfy(context.request.queryFile)
								}catch(e){
									var content = null ;
								}
							break;
							case "application/xml":
							case "text/xml":
							case "application/json":
							case "text/json":
							case "application/x-www-form-urlencoded":
								var content = context.request.body.toString(context.request.charset);
							break;
							default:
								var content = null ;
						}
						
						obj["request"] = {
							url:context.request.url.href,
							method:context.request.method,
							protocol:context.type,
							remoteAdress:context.request.remoteAdress,
							queryPost:context.request.queryPost,
							queryGet:context.request.queryGet,
							headers:context.request.headers,
							crossDomain:context.crossDomain,
							dataSize:context.request.dataSize,
							content:content,
							"content-type":context.request.contentType
						};
						obj["response"] = {	
							statusCode:context.response.statusCode,
							message:context.response.response.statusMessage,
							size:context.response.body.length ,
							encoding:context.response.encoding,
							"content-type":context.response.response.getHeader('content-type')
						};
						context.response.response.on("finish",function(){
							if (  this.settings.storage.requests == "orm"  ){
								this.updateProfile(context.profiling, context.profilingObject);	
							}
							delete obj ;
						}.bind(this))


						context.listen(this, "onSend", function(response, context){
							obj["timeRequest"] = (new Date().getTime() ) - (context.request.request.nodefony_time )+" ms";
							obj["response"] = {
								statusCode:response.statusCode,
								message:response.response.statusMessage,
								size:response.body.length ,
								encoding:response.encoding,
								"content-type":response.response.getHeader('content-type'),
								headers:response.response._headers	
							}
							if ( context.profiling ){
								context.profiling["timeRequest"] = obj["timeRequest"];
								context.profiling["events"] = 	obj["events"] ;
								context.profiling["response"] = obj["response"] ; 
							}
							if( !  context.request.isAjax() /*&& obj.route.name !== "monitoring"*/ ){
								var View = this.container.get("httpKernel").getView("monitoringBundle::debugBar.html.twig");
								if (response && typeof response.body === "string" && response.body.indexOf("</body>") > 0 ){
									this.get("templating").renderFile(View, obj,function(error , result){
										if (error){
											throw error ;
										}
										response.body = response.body.replace("</body>",result+"\n </body>") ;
									});
								}else{
									//context.setXjson(obj);
								}
								delete obj ;
							}else{
								//context.setXjson(obj);	
							}
						})

					break;
					case "WEBSOCKET":
					case "WEBSOCKET SECURE":
						//console.log(context)
						var configServer = {};
						obj["timeStamp"] = context.request.nodefony_time ;
						for (var conf in context.request.serverConfig){
							if ( conf == "httpServer")
								continue ;
							configServer[conf] = context.request.serverConfig[conf];	
						}

						obj["request"] = {
							url:context.request.httpRequest.url,
							headers:context.request.httpRequest.headers,
							method:context.request.httpRequest.method,
							protocol:context.type,
							remoteAdress:context.request.remoteAddress,
							serverConfig:configServer,
						};
						var config = {};
						for (var conf in context.response.config){
							if ( conf == "httpServer")
								continue ;
							config[conf] = 	context.response.config[conf];	
						}
						obj["response"] = {
							statusCode:context.response.statusCode,	
							connection:"WEBSOCKET",
							config:config,
							webSocketVersion:context.response.webSocketVersion,
							message:[],
						};
						context.listen(this,"onMessage", function(message, context, direction ){
							var ele = {
								date:new Date().toTimeString(),
								data:message,
								direction:direction
							}
							if (message && context.profiling ){
								context.profiling["response"].message.push( ele ) ;
							}
							this.updateProfile(context.profiling, context.profilingObject);
						})

						context.listen(this,"onClose" , function(reasonCode, description, connection){
							if ( context.profiling ){
								context.profiling["response"].statusCode = connection.state  ;	
							}

							this.updateProfile(context.profiling, context.profilingObject);
							
							delete obj ;
						})
					break;
				
				}

				context.listen(this, "onView", function(result, context, view, viewParam){
					if ( context.profiling ){
						try {
							JSON.stringify( viewParam ) ;
						}catch(e){
							viewParam = "view param can't be parse" ;
						}
						context.profiling["twig"].push({
							file:view,
							param:viewParam
						});
					}
				});

				this.profiling(context, obj, function(error, result, ele){
					if (error){
						this.kernel.logger(error, "ERROR");
						return ;
					}	
					context.profiling = result ;
					context.profilingObject = ele ;
					obj["requestId"] = result.id ;
				})	

			
			}
		});
	}		

	
	monitoring.prototype.updateProfile = function(obj, profilingObject){
		if ( obj) {
			switch( this.storageProfiling ){
				case "syslog" :
					profilingObject.payload = obj ;
					return ;
				break;
				case "orm":
					this.requestEntity.update({data:JSON.stringify(obj)}, {
  						where: {
    							id:obj.id,
  						}
					}).then(function(){
						//callback(null, serialize) ;	
						this.kernel.logger("ORM REQUEST SAVE","DEBUG");
					}.bind(this)).catch(function(error){
						this.kernel.logger(error);
						//callback(error, null) ;
					}.bind(this))
				break;
				default:
					callback(new Error("No PROFILING"), null)
			}	
		}
	}

	monitoring.prototype.profiling = function(context, obj , callback){
	
		if (  ! obj.route.name.match(/^monitoring-/) ){

			var requestObj = {
				id:null,
				timeStamp:obj["timeStamp"],
				queryPost:context.request.queryPost,
				queryGet:context.request.queryGet,
				queryFile:obj["queryFile"],
				proxy:obj["proxy"],
				response:obj["response"],
				request:obj["request"],
				locale:obj["locale"],
				context:obj["context"],
				protocole:context.type,
				session:obj["session"],
				security:obj["context_secure"] || {},
				events:obj["events"],
				routing:obj["routeur"] || [],
				route:obj["route"],
				routeParmeters:obj["varialblesName"],
				cookies:context.cookies,
				twig:[]
			};
			switch( this.storageProfiling ){
				
				case "syslog" :
					this.syslogContext.logger(requestObj);
					var logProfile = this.syslogContext.getLogStack();
					requestObj.id = logProfile.uid ;
					callback(null , requestObj, logProfile)
					return ;
				break;
				case "orm":
					// DATABASE ENTITY 
					this.requestEntity.create({id:null,data:JSON.stringify(requestObj) },{isNewRecord:true})
					.then(function(request){
						requestObj.id = request.id ;
						callback(null , requestObj, request);
					}.bind(this)).catch(function(error){
						this.kernel.logger(error);
						callback(error, null)
					}.bind(this));
				break;
				default:
					callback(new Error("No PROFILING"), null)
			}
		}
	
	}
	


	return monitoring;
});

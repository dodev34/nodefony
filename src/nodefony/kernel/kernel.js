/*
 *
 *
 *
 *
 */

nodefony.register("kernel", function(){
	
	/**
	 *	@event onTerminate
	 *
	 *
	 *	@event onReady
	 */

	/**
	 *	@event onBoot
	 */

	var regBundleName = /^(.*)Bundle[\.js]{0,3}$/;
	var regBundle = /^(.*)Bundle.js$/;

	var waitingBundle = function(){
		this.eventReadywait -= 1 ;
		if ( this.eventReadywait === 0 || this.eventReadywait === -1 ){
			process.nextTick( () => {
				try {
					this.logger("\x1B[33m EVENT KERNEL READY\x1b[0m", "DEBUG");
					this.fire("onReady", this);
					this.ready = true ;
					this.fire("onPostReady", this);
					this.logger("\x1B[33m EVENT KERNEL POST READY\x1b[0m", "DEBUG");
					if ( this.type === "SERVER" ){
						if (  global && global.gc ){
							this.memoryUsage("MEMORY POST READY ") ;
							setTimeout(()=>{
								global.gc();
								this.memoryUsage("EXPOSE GARBADGE COLLECTOR ON START") ;
							},5000)
						}else{
							this.memoryUsage("MEMORY POST READY ") ;
						}
					}
				}catch(e){
					this.logger(e, "ERROR");
				}
			});
		}
	};

	var niceBytes = function (x){
  		var units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
    		    n = parseInt(x, 10) || 0, 
    		    l = 0;        
  		while(n >= 1024){
      			n = n/1024;
      			l++;
  		}
  		return(n.toFixed(n >= 10 || l < 1 ? 0 : 1) + ' ' + units[l]);
	};

	
	var logConsole = function(syslog){
		var red, blue, green, reset, yellow;
		red   = '\x1b[31m';
		blue  = '\x1b[34m';
		green = '\x1b[32m';
		yellow = '\x1B[33m';
		reset = '\x1b[0m';

		// CRITIC ERROR
		syslog.listenWithConditions(this,{
			severity:{
				data:"CRITIC,ERROR"
			}		
		},(pdu) => {
			var pay = pdu.payload ? (pdu.payload.stack || pdu.payload) : "Error undefined" ; 
			var date = new Date(pdu.timeStamp) ;
			console.error(date.toDateString() + " " +date.toLocaleTimeString()+ " " + red + pdu.severityName +" "+ reset + green  + pdu.msgid + reset  + " : "+ pay);	
		});

		// INFO DEBUG
		var data ;
		if ( this.debug ){
			data = "INFO,DEBUG,WARNING" ;
		}else{
			data = "INFO" ;
		}
		syslog.listenWithConditions(this, {
			severity:{
				data:data
			}		
		},(pdu) => {
			//console.log(this.node_start)
			//console.log(pdu)
			if ( pdu.msgid === "SERVER WELCOME"){
				console.log(   blue + "              "+reset + " "+ pdu.payload);	
				return ;
			}
			//if ( this.preboot ){
				var date = new Date(pdu.timeStamp) ;
				console.log( date.toDateString() + " " +date.toLocaleTimeString()+ " " + blue + pdu.severityName +" "+ reset + green  + pdu.msgid + reset +" "+ " : "+ pdu.payload);	
			//}
		});
	};


	var defaultOptions = {
		nbListener:30
	};
	/**
	 *	KERKEL class   
	 *	The class is a **`KERNEL NODEFONY`** .
	 *	@module NODEFONY
	 *	@main nodefony
	 *	@class kernel
	 *	@constructor
	 *	@param {String} environment  DEV || PROD
	 *	@param {Bollean} debug
	 *	@param {class} autoLoader
	 *	
	 */
	var kernel = class kernel extends nodefony.Service {	

		constructor (environment, debug, autoLoader, type, options){

			super( "KERNEL" , null, null , nodefony.extend( {}, defaultOptions,  options) );
			this.rootDir = process.cwd();
			this.nodefonyPath = this.rootDir+"/vendors/nodefony/";
			this.appPath = this.rootDir+"/app/";
			this.configPath = this.rootDir+"/vendors/nodefony/config/config.yml" ;
			this.platform = process.platform ;
			this.type = type;
			this.bundles = {};
			this.environment = environment;
			this.debug = debug || false;
			if (this.debug){
				//this.preboot = true;
			}
			this.booted = false;
			this.ready = false;
			this.autoLoader = autoLoader;
			this.settings = null;
			this.regBundle = regBundle;

			this.options = options ;
			this.node_start = options.node_start ;

			this.listen(this, "onReady" , () =>{
				this.autoLoader.deleteCache();
			});

			/**
		 	*	@signals
		 	*
		 	*	onTerminate
		 	*/
			process.on('SIGINT', () => {
				this.logger("SIGINT", "CRITIC");
				this.fire("onSignal", "SIGINT", this);
				this.terminate(0);	
			});
			process.on('SIGTERM', () => {
				this.logger("SIGTERM", "CRITIC");
				this.fire("onSignal", "SIGTERM", this);
				this.terminate(0);	
			});
			process.on('SIGHUP', () => {
				this.logger("SIGHUP", "CRITIC");
				this.fire("onSignal", "SIGHUP", this);
				this.terminate(0);	
			});
			process.on('SIGQUIT',() =>{
				this.logger("SIGQUIT", "CRITIC");
				this.fire("onSignal", "SIGQUIT", this);
				this.terminate(0);
			});

			/**
		 	*	@promise
		 	*
		 	*	
		 	*/
			const unhandledRejections = new Map();
			process.on('rejectionHandled', (promise) => {
				this.logger("PROMISE REJECTION EVENT ", "CRITIC");
				unhandledRejections.delete(promise);
			});
			process.on('unhandledRejection', (reason, promise) => {
				this.logger("WARNING  !!! PROMISE CHAIN BREAKING : "+ reason, "CRITIC");
				unhandledRejections.set(promise, reason);
			});
			process.on('uncaughtException', (err) => {
				this.logger(err, "CRITIC");
			});

			this.boot(options);
		}
				
		/**
	 	*	@method boot
         	*/
		boot (options){	
			// Manage Container
			this.initializeContainer();
			
			// Manage Reader
			this.reader = new nodefony.Reader(this.container);
			this.set("reader",this.reader);
			this.set("autoLoader",this.autoLoader);

			this.reader.readConfig(this.configPath, (result) => {
				this.settings = result;
				this.settings.environment = this.environment ;
				this.setParameters("kernel", this.settings);
				this.httpPort = result.system.httpPort || null;
				this.httpsPort = result.system.httpsPort || null;
				this.domain = result.system.domain || null;
				this.hostname = result.system.domain || null ;
				this.hostHttp = this.hostname +":"+this.httpPort ;
				this.hostHttps = this.hostname +":"+this.httpsPort ;
				this.domainAlias = result.system.domainAlias ;
				// manage LOG
				if (this.environment === "prod"){
					this.environment = result.system.debug ? "dev" : "prod" ;
				}
				this.initializeLog(options);
				this.autoLoader.syslog = this.syslog;
				//this.container.set("syslog",this.syslog);
			});

			this.initCluster();

			this.eventReadywait = 0 ;

			// Manage Template engine
			this.initTemplate();	

			// Manage Injections
			this.injection = new nodefony.injection(this.container);
			this.set("injection", this.injection);

			/*
 		 	*	BUNDLES
 		 	*/
			var bundles = [];
			bundles.push("./vendors/nodefony/bundles/httpBundle");
			bundles.push("./vendors/nodefony/bundles/frameworkBundle");
			bundles.push("./vendors/nodefony/bundles/asseticBundle");

			
			// FIREWALL 
			if (this.settings.system.security){
				bundles.push("./vendors/nodefony/bundles/securityBundle");
			}

			// ORM MANAGEMENT
			switch ( this.settings.orm ){
				case "sequelize" :
					bundles.push("./vendors/nodefony/bundles/sequelizeBundle");
 				break;
				default :
					throw new Error ("nodefony can't load ORM : " + this.settings.orm );
			}

			// REALTIME
			if ( this.settings.system.realtime) {
				bundles.push("./vendors/nodefony/bundles/realTimeBundle");
			}

			// MONITORING
			if ( this.settings.system.monitoring) {
				bundles.push("./vendors/nodefony/bundles/monitoringBundle");
			}

			

			try {
				this.fire("onPreRegister", this );
			}catch(e){
				this.logger(e);
			}
			this.registerBundles(bundles, () => {
				this.preboot = true ;
				this.logger("\x1B[33m EVENT KERNEL onPreBoot\x1b[0m", "DEBUG");
				this.fire("onPreBoot", this );
			}, false);
		}

		initCluster (){
			this.processId = process.pid ;
			this.process = process ;
			if (cluster.isMaster) {
				console.log("		      \x1b[34mNODEFONY "+this.type+" CLUSTER MASTER \x1b[0mVersion : "+ this.settings.system.version +" PLATFORM : "+this.platform+"  PROCESS PID : "+this.processId+"\n");
				this.fire("onCluster", "MASTER", this,  process);

			}else if (cluster.isWorker) {
				console.log("		      \x1b[34mNODEFONY "+this.type+" CLUSTER WORKER \x1b[0mVersion : "+ this.settings.system.version +" PLATFORM : "+this.platform+"  PROCESS PID : "+this.processId);
				this.workerId = cluster.worker.id ;
				this.worker = cluster.worker ;
				this.fire("onCluster", "WORKER",  this, process);
				process.on("message" , this.listen(this, "onMessage" ) ); 
				/*this.listen(this, "onMessage", function(worker, message){
				})*/
			}
		}

		sendMessage (message){
			return process.send({
				type : 'process:msg',
				data : message
			});
		}
			
		/**
	 	*	@method initializeLog
         	*/
		initializeLog (options){
			
			if ( this.settings.system.log.console ||  this.environment === "dev"){
				logConsole.call(this, this.syslog);
			}else{
				// PM2
				if ( this.settings.system.log.active && options.node_start === "PM2" ){
					logConsole.call(this, this.syslog);
				}

				if ( this.settings.system.log.file ){
					this.logStream = new nodefony.log(this.rootDir+this.settings.system.log.error,{
						rotate:this.settings.system.log.rotate
					});
					this.syslog.listenWithConditions(this,{
						severity:{
							data:"CRITIC,ERROR"
						}		
					},function(pdu){
						var pay = pdu.payload ? (pdu.payload.stack || pdu.payload) : "Error undefined" ;
						var reg = new RegExp("\\[32m");
						var line = pdu.severityName +" SYSLOG "  + pdu.msgid +  " " + pdu.msg+" : "+ pay.replace(reg,"");
						this.logStream.logger( new Date(pdu.timeStamp) + " " +line +"\n" );
					});	
					var data ;
					this.logStreamD = new nodefony.log(this.rootDir+this.settings.system.log.messages,{
						rotate:this.settings.system.log.rotate
					});
					if ( this.debug ){
						data = "INFO,DEBUG,WARNING" ;
					}else{
						data = "INFO" ;
					}
					this.syslog.listenWithConditions(this,{
						severity:{
							data:data
						}		
					},function(pdu){
						if ( pdu.msgid === "SERVER WELCOME"){
							console.log(  pdu.payload);	
							return ;
						}
						if (! pdu.payload ) { return ; } 
						var reg = new RegExp("\\[32m");
						var line = pdu.severityName +" SYSLOG "  + pdu.msgid +  " : "+ pdu.payload.replace(reg,"");
						this.logStreamD.logger( new Date(pdu.timeStamp) + " " +line +"\n" );
					});
				}
			}
		}

		/**
	 	*	@method initializeContainer
         	*/
		initializeContainer (){
			this.set("kernel", this);	
		}

		/**
	 	*	@method getTemplate
         	*/	
		getTemplate (name){
			return nodefony.templatings[name];
		}

		/**
	 	*	@method initTemplate
         	*/
		initTemplate (){
			var classTemplate = this.getTemplate(this.settings.templating);
			this.templating = new classTemplate(this.container, this.settings[this.settings.templating]);
			this.set("templating", this.templating );
		}

		/**
	 	*	@method logger
         	*/
		logger (pci, severity, msgid,  msg){
			if (! msgid) { msgid = "KERNEL ";}
			return this.syslog.logger(pci, severity, msgid,  msg);
		}

		/**
	 	*	get bundle instance
	 	*	@method getBundle 
	 	*	@param {String} name
         	*/
		getBundle (name){
			for (var ns in this.bundles){
				if (ns === name){
					return this.bundles[ns];
				}
			}
			return null;	
		}

		/**
	 	*	get all Bundles instance
	 	*	@method getBundles 
	 	*	@param {String} name
         	*/
		getBundles (name){
			if (name){
				return this.getBundle(name);
			}
			return this.bundles;	
		}
		
		/**
	 	*	get  Bundle name
	 	*	@method getBundleName 
	 	*	@param {String} str
         	*/
		getBundleName (str){
			var ret = regBundleName.exec(str);
			if ( ret){
				return  ret[1] ;
			}
			throw new Error("Bundle Name :" +str +" not exist") ;
		}
		
		loadBundle (file){
			try {
				var name = this.getBundleName(file.name);
				var Class = this.autoLoader.load(file.path);
				if (Class) {
					if (typeof Class === "function" ){
						Class.prototype.path = file.dirName;
						Class.prototype.autoLoader = this.autoLoader;
						this.bundles[name] = new Class( name, this, this.container);
						if ( this.bundles[name].waitBundleReady ){
							this.eventReadywait += 1 ;
							this.bundles[name].listen(this,"onReady", waitingBundle);
						}	
					}
				}	
			}catch(e){
				throw e ;
			}
		}

		/**
	 	*	register Bundle 
	 	*	@method registerBundles 
	 	*	@param {String} path
	 	*	@param {Function} callbackFinish
         	*/
		registerBundles (path, callbackFinish, nextick){
			var func = function(){
				try{
					 new nodefony.finder( {
						path:path,
						recurse:false,
						onFile:(file) => {
							if (file.matchName(this.regBundle) ){
								try {
									this.logger("registerBundles in appkernel.js : " + file.name ,"DEBUG","APP KERNEL");
									this.loadBundle(file);
								}catch(e){
									this.logger(e);
								}	
							}
						},
						onFinish:callbackFinish || this.initializeBundles.bind(this)
					});
				}catch(e){
					for( let i=0 ; i < path.length ; i++){
						this.logger("registerBundles in appkernel.js : " + path[i] ,"DEBUG");
					}
					this.logger(e, "ERROR");
				}
			};
			if ( nextick === undefined ){
				process.nextTick( func.bind(this) );	
			}else{
				func.apply(this);
			}
		}

		/**
	 	*	initialisation application bundle 
	 	*	@method initApplication 
         	*/	
		initApplication (){
			var App = class App extends nodefony.Bundle {
				constructor (name, myKernel, myContainer){
					super(name, myKernel, myContainer);
				}
			};
			App.prototype.path = this.appPath ;
			App.prototype.autoLoader = this.autoLoader;
			this.bundles.App = new App("App", this, this.container);
			this.readConfigDirectory(this.appPath+"config", (result) => {
				if (result){
					this.bundles.App.parseConfig(result);
				}
			});
			// OVERRIDE VIEWS BUNDLE in APP DIRECTORY
			this.listen(this, "onBoot" , () => {
				for (var bundle in this.bundles){
					if (bundle === "App") { continue ; }
					var result = this.bundles.App.resourcesFiles.findByNode(bundle+"Bundle");
					if ( result.length() ){
						try {
							this.logger("\x1b[32m APP OVERRIDING\x1b[0m views for bundle : "+bundle, "DEBUG");
							this.bundles[bundle].registerViews(result);
							//FIXME LOCALE
							this.bundles[bundle].registerI18n(null, result);
						}catch(e){
							this.logger(e);
						}
					}
				}
			});
			return this.bundles.App;
		}

		/**
	 	*	initialisation  all bundles 
	 	*	@method initializeBundles 
         	*/	
		initializeBundles (){

			this.app = this.initApplication();
			
			this.logger("\x1B[33m EVENT KERNEL onPostRegister\x1b[0m", "DEBUG");
			this.fire("onPostRegister", this);

			for (var name in this.bundles ){
				this.logger("\x1b[36m INITIALIZE Bundle :  "+ name.toUpperCase()+"\x1b[0m","DEBUG");
				try {
					this.bundles[name].boot();
				}catch (e){
					this.logger("BUNDLE :"+name+" "+ e);
					continue ;
				}
			}
			if ( this.eventReadywait  === 0) { waitingBundle.call(this) ; }
			this.logger("\x1B[33m EVENT KERNEL BOOT\x1b[0m", "DEBUG");
			this.fire("onBoot", this);
			this.booted = true ;
			return;
		}
	
		/**
	 	*	 
	 	*	@method readConfigDirectory 
         	*/	
		readConfigDirectory (path, callbackConfig){
			var finder = new nodefony.finder({
				path:path,
				onFinish:(error, result) => {
					this.readConfig.call(this, error, result, callbackConfig);
				}
			});
			return finder ;
		}

		/**
	 	*	 
	 	*	@method readConfig 
         	*/
		readConfig (error, result, callback){
			if (error){
				this.logger(error);
			}else{
				result.forEach((ele) => {
					switch (true){
						case /^config\..*$/.test(ele.name) :
							try {
								this.logger("CONFIG LOAD FILE :"+ele.path ,"DEBUG","SERVICE KERNEL READER");
								this.reader.readConfig( ele.path, callback );
							}catch(e){
								this.logger(util.inspect(e),"ERROR","BUNDLE "+this.name.toUpperCase()+" CONFIG :"+ele.name);
							}
							break;
						case /^routing\..*$/.test(ele.name) :
							// ROUTING
							try {
								this.logger("ROUTER LOAD FILE :"+ele.path ,"DEBUG", "SERVICE KERNEL READER");
								var router = this.get("router") ;
								if ( router ){
									router.reader(ele.path);
								}else{
									this.logger("Router service not ready to LOAD FILE :"+ele.path ,"WARNING", "SERVICE KERNEL READER");	
								}
							}catch(e){
								this.logger(util.inspect(e),"ERROR","BUNDLE "+this.name.toUpperCase()+" CONFIG ROUTING :"+ele.name);
							}
							break;
						case /^services\..*$/.test(ele.name) :
							try {
								this.logger("SERVICE LOAD FILE :"+ele.path ,"DEBUG", "SERVICE KERNEL READER");
								//this.kernel.listen(this, "onBoot", function(){
									this.get("injection").reader(ele.path);
								//});
							}catch(e){
								this.logger(util.inspect(e),"ERROR","BUNDLE "+this.name.toUpperCase()+" CONFIG SERVICE :"+ele.name);
							}
							break;
						case /^security\..*$/.test(ele.name) :
							try {
								var firewall = this.get("security") ;
								if ( firewall ){
									this.logger("SECURITY LOAD FILE :"+ele.path ,"DEBUG", "SERVICE KERNEL READER");
									firewall.reader(ele.path);
								}else{
									this.logger("SECURITY LOAD FILE :"+ele.path +" BUT SERVICE NOT READY" ,"WARNING");	
								}
							}catch(e){
								this.logger(util.inspect(e),"ERROR","BUNDLE "+this.name.toUpperCase()+" CONFIG SECURITY :"+ele.name);
							}
							break;
					}
				});
			}
		}

		memoryUsage (message){
			var memory =  process.memoryUsage() ;
			for ( var ele in memory ){
				switch (ele ){
					case "rss" :
						this.logger( (message || ele )  + " ( Resident Set Size ) PID ( "+this.processId+" ) : " + niceBytes( memory[ele] ) , "INFO", "MEMORY " + ele) ;
					break;
					case "heapTotal" :
						this.logger( (message || ele ) + " ( Total Size of the Heap ) PID ( "+this.processId+" ) : " + niceBytes( memory[ele] ) , "INFO","MEMORY " + ele) ;
					break;
					case "heapUsed" :
						this.logger( (message || ele ) + " ( Heap actually Used ) PID ( "+this.processId+" ) : " + niceBytes( memory[ele] ) , "INFO", "MEMORY " + ele) ;
					break;
					case "external" :
						this.logger( (message || ele ) + " PID ( "+this.processId+" ) : " + niceBytes( memory[ele] ) , "INFO", "MEMORY " + ele) ;
					break;
				}
			}
		}

		/**
	 	*	 
	 	*	@method terminate 
         	*/
		terminate (code){
			try {
				this.fire("onTerminate", this);
			}catch(e){
				console.trace(e);
				code = 1;
				process.nextTick( () => {
					this.logger("Kernel Life Cycle Terminate CODE : "+code,"INFO");
				});
				this.logger(e,"ERROR");
			}
			if (this.logStream){
				this.logStream.close("Close error stream\n");
			}
			if (this.logStreamD){
				this.logStreamD.close("Close debug stream\n");	
			}
			process.nextTick( () => {
				this.logger("Kernel Life Cycle Terminate CODE : "+code,"INFO");
				process.exit(code);
			});
			return ;
		}
	};

	return kernel ;
});

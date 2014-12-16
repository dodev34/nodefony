/*
 *
 *
 *
 *
 *
 */

nodefony.register("Bundle", function(){
	
	/*
 	 *	BUNDLE CLASS
 	 */
	var Bundle = function(kernel , container){
		this.logger("\033[32m REGISTER BUNDLE : "+this.name+"   \033[0m","DEBUG","KERNEL");
		this.kernel = kernel ;
		this.notificationsCenter = nodefony.notificationsCenter.create();
		this.waitBundleReady = false ;
		this.container = container ;
		this.container.setParameters("bundles."+this.name,{});
		this.finder = new nodefony.finder( {
			path:this.path,
			exclude:/^docs$|^test$|^public$/
		});
		this.controllers = {};
		this.views = {};
		//this.views["Default"] = {};
		this.views["."] = {};
		this.entities = {};
		this.fixtures = {};

		//this.services = {};
		this.reader = this.container.get("kernel").reader;
		
		this.resourcesFiles = this.finder.result.findByNode("Resources") ;

		// Register Service
		this.registerServices();

		// read config files
		this.kernel.readConfig.call(this, null, this.resourcesFiles.findByNode("config") ,function(result){
			this.parseConfig(result);
		}.bind(this))
		this.regTemplateExt = new RegExp("^(.+)\."+this.container.get("templating").extention+"$");
		
	};
	
	Bundle.prototype.parseConfig = function(result){
		if (result){
			for (var ele in result){
				switch (true){
					case /^(.*)Bundle$/.test(ele) :
						var name = /^(.*)Bundle$/.exec(ele)
						this.logger("\033[32m OVERRIDING\033[0m  bundle config : "+name[1] +" in bundle :" + this.name ,"DEBUG")
						var config = this.container.getParameters("bundles."+name[1])
						if ( config ){
							var ext = nodefony.extend(true, {}, config , result[ele])
							this.container.setParameters("bundles."+name[1], ext);	
						}
					break;
					case /^locale$/.test(ele) :
						this.locale = result[ele] ;
					break;
				}
			}
			this.container.setParameters("bundles."+this.name,result);	
		}
	};

	Bundle.prototype.listen = function(){
		return this.notificationsCenter.listen.apply(this.notificationsCenter, arguments);
	};

	Bundle.prototype.fire = function(ev){
		this.logger(ev, "DEBUG", "EVENT BUNDLE "+this.name+"\033[0m")
		return this.notificationsCenter.fire.apply(this.notificationsCenter, arguments);
	};

	Bundle.prototype.logger = function(pci, severity, msgid,  msg){
		var syslog = this.container.get("syslog")
		if (! msgid) msgid = "BUNDLE "+this.name.toUpperCase();
		return syslog.logger(pci, severity, msgid,  msg)
	}

	Bundle.prototype.loadFile = function(path){
		return this.autoLoader.load(path);
	};

	Bundle.prototype.boot = function(){
		this.fire("onBoot",this);
		// Register Controller
		this.registerControllers();

		// Register Views
		this.registerViews( this.resourcesFiles );

		// Register internationalisation 
		this.registerI18n(this.locale);

		// Register Entity 
		this.registerEntities();
		
		// Register Entity 
		this.registerFixtures();

		if ( this.waitBundleReady === false ){
			this.fire("onReady",this);
		}

	};

	Bundle.prototype.getName = function(){
		return this.name;
	};

	Bundle.prototype.getController = function(name){
		return this.controllers[name];
	};
	
	var regService = /^(.+)Service.js$/;
	Bundle.prototype.registerServices = function(){
		// find  controler files 
		var services = this.finder.result.findByNode("services");
		services.forEach(function(ele, index, array){
			var res = regService.exec( ele.name );
			if ( res ){
				var name = res[1] ;
				var Class = this.loadFile( ele.path );
				if (typeof Class !== "function" ){
					this.logger("Register Service : "+name +"  error Service bad format")
				}/*else{
					this.logger("Register Service : "+name , "INFO");
				}*/
			}
		}.bind(this));
	};

	var regController = /^(.+)Controller.js$/;
	Bundle.prototype.registerControllers = function(){
		// find  controler files 
		var controller = this.finder.result.findByNode("controller");
		controller.forEach(function(ele, index, array){
			var res = regController.exec( ele.name );
			if ( res ){
				var name = res[1] ;
				var Class = this.loadFile( ele.path);
				if (typeof Class === "function" ){
					//Class.prototype.path = ele.dirName;
					Class.prototype.name = name;
					Class.prototype.container = this.container;
					Class.prototype.bundle = this;
					//Class.prototype.viewFiles = this.viewsFile.findByNode(name);
					var func = Class.herite(nodefony.controller);
					//this.controllers[name] = new func(this.container);
					this.controllers[name] = func ;
					this.logger("Register Controller : "+name , "DEBUG");
				}else{
					this.logger("Register Controller : "+name +"  error Controller bad format");
				}
			}
		}.bind(this));

	};

	Bundle.prototype.registerViews = function(result){
		// find  views files 
		var views = result.findByNode("views") ;
		views.getFiles().forEach(function(file, index, array){
			var basename = path.basename(file.dirName);
			if (basename !== "views"){
				// directory 
				if ( ! this.views[basename] ){
					this.views[basename] = {};
				}
				var res = this.regTemplateExt.exec( file.name );
				if (res){
					var name = res[1];
					this.views[basename][name]= file;
					this.logger("Register View : '"+this.name+"Bundle:"+basename+":"+name +"'", "DEBUG");
				}
			}else{
				// racine
				//var basename = "Default";
				var basename = ".";
				var res = this.regTemplateExt.exec( file.name );
				if (res){
					var name = res[1];
					this.views[basename][name]= file;
					this.logger("Register View : '"+this.name+"Bundle:"+""+":"+name + "'", "DEBUG");
				}
			}
		}.bind(this));
	};

	Bundle.prototype.getView = function(viewDirectory, viewName){
		if ( this.views[viewDirectory] ){
			var res = this.regTemplateExt.exec( viewName );
			if (res){
				var name = res[1];
				if ( this.views[viewDirectory][name] )
					return this.views[viewDirectory][name];
				throw new Error("Bundle "+ this.name+" directory : "+viewDirectory +" GET view file Name : "+ viewName +" Not Found");
			}else{
				throw new Error("Bundle "+ this.name+" directory : "+viewDirectory +" GET view file Name : "+ viewName +" Not Found");
			}
		}else{
			throw new Error("Bundle "+ this.name+" GET view directory : "+viewDirectory +" Not Found");
		}
	};

	Bundle.prototype.registerI18n = function(locale, result){
		var translation = this.get("translation");
		if (! translation ) return ;
		// find i18n files
		if (result)
			var i18nFiles = result.findByNode("translations");
		else
			var i18nFiles = this.resourcesFiles.findByNode("translations");
		if (! i18nFiles.length() ) return ;
		if (locale){
			var defaultLocale =  locale;	
			var reg = new RegExp("^(.*)\.("+defaultLocale+")\.(.*)$"); 
			var files = i18nFiles.match(reg);
		}else{
			var defaultLocale =  translation.defaultLocale  ;
			if (! defaultLocale ) return ;
			var reg = new RegExp("^(.*)\.("+defaultLocale+")\.(.*)$"); 
			var files = i18nFiles.match(reg);
			if ( ! files.length() ){
				var bundleLocal = this.container.getParameters("bundles."+this.name+".locale") ;
				if ( bundleLocal ){
					defaultLocale = bundleLocal ; 	
				}
				var reg = new RegExp("^(.*)\.("+defaultLocale+")\.(.*)$"); 
				files = i18nFiles.match(reg);
				if ( bundleLocal  && ! files.length() ){
					throw new Error("Error Translation file locale: "+defaultLocale+" don't exist")
				}
			}
		}
		files.getFiles().forEach(function(file, index, array){
			//var basename = path.basename(file.dirName)
			var domain = file.match[1] ;
			var Locale = file.match[2] ;
			translation.reader(file.path, Locale, domain)
		}.bind(this));
	};


	/*
 	 *
 	 *	COMMAND
 	 *
 	 */
	var regCommand = /^(.+)Command.js$/;
	var proto = {
		createDirectory : function(path, mode, callback){
			try {
				var res = fs.mkdirSync(path, mode);
				var file = new nodefony.fileClass(path);
				callback( file );
				return file
			}catch(e){
				throw e
			}
		},
		createFile : function(path, skeleton, parse, params, callback){
			if ( skeleton ){
				this.buildSkeleton(skeleton, parse, params,function(error, result){
					if (error){
						this.logger(error, "ERROR");	
					}else{
						try {
							var res = fs.writeFileSync(path, result,{
								mode:"777"
							});
							callback( new nodefony.fileClass(path) ); 
						}catch(e){
							throw e	
						}		
					}					
				}.bind(this));
			}else{
				var data = "/* generate by nodefony */";
				try {
					var res = fs.writeFileSync(path, data,{
						mode:"777"
					});
					callback( new nodefony.fileClass(path) ); 
				}catch(e){
					throw e	
				}
			}
		},
		buildSkeleton : function(skeleton, parse, obj, callback){
			try {
				var skelete = new nodefony.fileClass(skeleton);
				if (skelete.type === "File"){
					if (parse !== false){
						this.twig.renderFile(skelete, obj, callback);
					}else{
						callback(null, fs.readFileSync(skelete.path,{
							encoding:'utf8'
						}))
					}
				}else{
					throw new Error( " skeleton must be file !!! : "+ skelete.path);
				}
			}catch(e){
				this.logger(e, "ERROR")
			}
			return skelete;
		},
		build : function(obj, parent){
			var child = null;
			switch ( nodefony.typeOf(obj) ){
				case "array" :
					for (var i = 0 ; i < obj.length ; i++){
						this.build(obj[i], parent);
					}	
				break;
				case "object" :
					for (var ele in obj ){
						var value = obj[ele];
						switch (ele){
							case "name" :
								var name = value;
							break;
							case "type" :
								switch(value){
									case "directory":
										var child = this.createDirectory(parent.path+"/"+name, "777", function(ele){
											this.logger("Create Directory :" + ele.name)
										}.bind(this) );
									break;
									case "file":
										this.createFile(parent.path+"/"+name, obj.skeleton, obj.parse, obj.params, function(ele){
											this.logger("Create File      :" + ele.name)
										}.bind(this) );
									break;
								}
							break;
							case "childs" :
								try {
									//console.log(value)
									this.build(value, child);
								}catch (e){
									this.logger(e, "ERROR");
								}
							break;
						}
					}
				break;
				default:
					this.logger("generate build error arguments : "+ ele, "ERROR" );
			}
			return child ;
		}
 	};		
	Bundle.prototype.registerCommand =function(store){
		// find i18n files
		this.commandFiles = this.finder.result.findByNode("Command") ;
		this.commandFiles.getFiles().forEach(function(file, index, array){
			var res = regCommand.exec( file.name );
			if (res){
				try{
					var command = this.loadFile( file.path);
				}catch(e){
					throw new Error( e + "   FILE COMMAND : "+ file.path);
				}
				if (! command ){
					throw new Error("Command : "+file+" BAD FORMAT");
				}
				var name = command.name || res[1] ;
				if (! name ) throw new error("Command : "+name+"BAD FORMAT NANE ");

				if ( ! store[this.name] ){
					store[this.name] = {};	
				}
				if (command.worker){
					for (var func in proto){
						command.worker.prototype[func] = proto[func] ;	
					}
					command.worker.prototype.container = this.container;
					command.worker.prototype.terminate = this.kernel.terminate.bind(this.kernel);
					command.worker.prototype.logger = this.logger.bind(this) 
					command.worker.prototype.twig = this.container.get("templating");

					if ( command.commands ){
						command.worker.prototype.commands = command.commands ;
						store[this.name][name] = command.worker ; 
						//this.kernel.commands[name] = command.worker ;
					}else{
						throw new error("Command : "+name+"BAD FORMAT commands ");	
					}	
				}else{
					throw new error("Command : "+name+" WORKER COMMAND NOT FIND");
				}
			}
		}.bind(this));
	};

	Bundle.prototype.getPublicDirectory = function(){
		try {
			var res  = new nodefony.finder( {
				path:this.path+"/Resources/public",
				exclude:/^docs$|^test$/
			});
		}catch(e){
			this.logger(e,"ERROR");
		}
		return res.result;

	};

	var regEntity = /^(.+)Entity.js$/;
	Bundle.prototype.registerEntities = function(){
		this.entityFiles = this.finder.result.findByNode("Entity") ;
		if (this.entityFiles.length()){
			this.entityFiles.getFiles().forEach(function(file, index, array){
				var res = regEntity.exec( file.name );
				if ( res ){
					var name = res[1] ;
					var Class = this.loadFile( file.path);
					if (typeof Class.entity === "function" ){
						Class.entity.prototype.bundle = this;
						this.entities[name] = Class;
						this.logger("LOAD ENTITY : "+file.name ,"DEBUG")
					}else{
						this.logger("Register ENTITY : "+name +"  error ENTITY bad format")
					}
				}
			}.bind(this));	
		}
	};

	Bundle.prototype.getEntity = function(name){
		if ( this.entities[name] ){
			return this.entities[name];
		}
		return null ;
	};

	Bundle.prototype.getEntities = function(name){
		if ( this.entities ){
			return this.entities;
		}
		return null ;
	};

	var regFixtures = /^(.+)Fixtures.js$/;
	Bundle.prototype.registerFixtures = function(){
		this.fixtureFiles = this.finder.result.findByNode("Fixtures") ;
		if (this.fixtureFiles.length()){
			this.fixtureFiles.getFiles().forEach(function(file, index, array){
				var res = regFixtures.exec( file.name );
				if ( res ){
					var name = res[1];
					var Class = this.loadFile( file.path);
					if (typeof Class.fixture === "function" ){
						Class.fixture.prototype.bundle = this;
						this.fixtures[name] = Class;
						this.logger("LOAD FIXTURE : "+file.name ,"DEBUG")
					}else{
						this.logger("Register FIXTURE : "+name +"  error FIXTURE bad format")
					}
				}
			}.bind(this));	
		}
	};
	
	Bundle.prototype.getFixture = function(name){
		if ( this.fixtures[name] ){
			return this.fixtures[name];
		}
		return null ;
	};

	Bundle.prototype.getFixtures = function(){
		if ( this.fixtures ){
			return this.fixtures;
		}
		return null ;
	};

	Bundle.prototype.get = function(name){
                if (this.container)
                        return this.container.get(name);
                return null;
        };

        Bundle.prototype.set = function(name, obj){
                if (this.container)
                        return this.container.set(name, obj);
                return null;
        };

	return Bundle;
});
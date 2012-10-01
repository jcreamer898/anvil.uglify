var jsp = require( "uglify-js" ).parser;
var pro = require( "uglify-js" ).uglify;

var uglifyFactory = function( _, anvil ) {
	return anvil.plugin( {
		name: "anvil.uglify",
		activity: "post-process",
		all: false,
		inclusive: false,
		exclusive: false,
		fileList: [],
		commander: [
			[ "-u, --uglify", "uglify all javascripts" ]
		],

		configure: function( config, command, done ) {
			if( this.config ) {
				if( this.config.all ) {
					this.all = true;
				} else if ( this.config.include ) {
					this.inclusive = true;
					this.fileList = this.config.include;
				} else if ( this.config.exclude ) {
					this.exclusive = true;
					this.fileList = this.config.exclude;
				}
			} else if( command.uglify ) {
				this.all = true;
			}
			done();
		},

		run: function( done ) {
			var self = this,
				jsFiles = [];
			if ( this.inclusive ) {
				jsFiles = this.inclusive;
			} else if( this.all || this.exclusive ) {
				jsFiles = _.filter( anvil.project.files, function( file ) {
					return file.extension() === ".js";
				} );

				if( this.exclusive ) {
					jsFiles = _.reject( jsFiles, function( file ) {
						return _.any( self.fileList, function( excluded ) {
							var excludedAlias = anvil.fs.buildPath( [ file.relativePath, file.name ] ),
								matched = excluded === excludedAlias || excluded === ( "." + excludedAlias );
							return matched;
						} );
					} );
				}
			}
			if( jsFiles.length > 0 ) {
				anvil.log.step( "Uglifying " + jsFiles.length + " files" );
				anvil.scheduler.parallel( jsFiles, this.minify, function() { done(); } );
			} else {
				done();
			}
		},

		minify: function( file, done ) {
			var self = this;
			anvil.fs.read( [ file.workingPath, file.name ], function( content, err ) {
				if( !err ) {
					try {
						ast = jsp.parse( content );
					}
					catch ( e ) {
						anvil.events.raise( "build.stop", [
							"Uglify parsing has failed in", 
							file.name,
							"at line",
							e.line,
							"col",
							e.col,
							"."].join(" ") );
							
						return;
					}
					ast = pro.ast_mangle( ast );
					ast = pro.ast_squeeze( ast );
					var final = pro.gen_code( ast ),
						newName = self.rename( file.name );

					anvil.fs.write( [file.workingPath, newName ], final, function( err ) {
						if( err ) {
							anvil.log.error( "Error writing " + file.fullPath + " for uglification: \n" + err.stack );
						} else {
							var minified = _.clone( file );
							minified.name = newName;
							anvil.project.files.push( minified );
						}
						done();
					} );
				} else {
					anvil.log.error( "Error reading " + file.fullPath + " for uglification: \n" + err.stack  );
					done();
				}
			} );
		},

		rename: function( name ) {
			return name.replace( ".js", ".min.js" );
		}
	} );
};

module.exports = uglifyFactory;
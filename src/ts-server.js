import http from "http"
import open from "open"
import express from "express"
import livereload from "connect-livereload"
import tinyLr from "tiny-lr"
import watch from "watch"
import url from "url"
import extend from "extend"
import serveIndex from "serve-index"

export default class TsServer {
	constructor(options) {
		this.options = null
		this.livereloadServer = null
		this.watcher = null
		this.server = null
		this.status = false

		if(typeof options === "object") {
			this.set(options)
		}
	}
	set(options) {
		var defaults = {
			host: "localhost",
			port: 8978,
			root: ".",
			open: "/",
			livereload: {
				enable: true,
				port: 9572,
				directory: ".",
				filter: function (file) {
					if(file.match(/node_modules/)) {
						return false
					}
					else {
						return true
					}
				},
				callback: function(file, current, previous) {},
			},
			middleware: [],
			indexes: false,
			onStart: function(app) {},
			onOpen: function() {},
			onReload: function() {},
			onRestart: function() {},
			onStop: function() {},
		}
		this.options = extend(true, {}, defaults, options)

		return this
	}
	start() {
		if(!this.options) {
			console.log("options have not been set. use set(options) to set.")
			return
		}

		if(this.status) {
			console.log("this server is running, stop it first.")
			return
		}

		var options = this.options
		var app = express()

		// middleware routers
		if(options.middleware instanceof Array) {
			options.middleware
				.filter(item => typeof item === "function")
				.forEach(item => app.use(item))
		}

		// livereload
		if(options.livereload.enable) {
			// setup routers
			app.use(livereload({
				port: options.livereload.port,
			}))
			// setup a tiny server for livereload backend
			var livereloadServer = tinyLr()
			livereloadServer.listen(options.livereload.port, options.host)
			this.livereloadServer = livereloadServer
			// watch files for livereload
			this.watcher = watch.watchTree(options.livereload.directory, {
				ignoreDotFiles: options.livereload.ignoreDotFiles,
				filter: options.livereload.filter,
				ignoreDirectoryPattern: options.livereload.ignoreDirectoryPattern,
			}, (file, current, previous) => {
				if(typeof file == "object" && previous === null && current === null) {
					// ready
		    }
		    else {
		      // changed
					livereloadServer.changed({
						body: {
							files: file,
						},
					})
					if(typeof options.onReload === "function") {
						options.onReload()
					}
					if(typeof options.livereload.onChange === "function") {
						options.livereload.callback(file, current, previous)
					}
		    }
			})
		}

		// directory list can be seen if there is not a index.html
		if(options.indexes) {
			app.use(serveIndex(options.root))
		}

		// our local path routers
		app.use(express.static(options.root))

		// backend server
		if(typeof options.onStart === "function") {
			options.onStart(app)
		}

		var self = this
		var server = this.server = http.createServer(app).listen(options.port, options.host, () => {
			self.open(options.open)
			self.status = true
		})
	}

	stop() {
		var options = this.options
		var server = this.server
		if(server && typeof server.close === "function") {
			server.close()
		}

		var livereloadServer = this.livereloadServer
		if(livereloadServer && typeof livereloadServer.close === "function") {
			livereloadServer.close()
			if(this.watcher) {
				this.watcher.unwatchTree(options.livereload.directory)
			}
		}

		if(typeof options.onStop === "function") {
			options.onStop()
		}

		this.status = false
	}

	restart() {
		this.stop()
		this.options.open = false // prevent to open another browser
		this.start()

		var options = this.options
		if(typeof options.onRestart === "function") {
			options.onRestart()
		}
	}

	reload() {
		var options = this.options
		var livereloadServer = this.livereloadServer
		if(livereloadServer && typeof livereloadServer.changed === "function") {
			livereloadServer.changed({
				body: {
					files: ".",
				},
			})

			if(typeof options.onReload === "function") {
				options.onReload()
			}
		}
	}

	// open helper to open a uri base on current url root
	open(uri) {
		if(!uri) {
			return
		}
		var options = this.options
		var page = url.format({
			protocol: "http",
			hostname: options.host,
			port: options.port,
			pathname: uri,
		})
		open(page)
		if(typeof options.onOpen === "function") {
			options.onOpen(page)
		}
	}

}
module.exports = TsServer

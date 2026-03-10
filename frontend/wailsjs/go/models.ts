export namespace internal {
	
	export class GameModeStatus {
	    installed: boolean;
	    running: boolean;
	    version: string;
	
	    static createFrom(source: any = {}) {
	        return new GameModeStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.installed = source["installed"];
	        this.running = source["running"];
	        this.version = source["version"];
	    }
	}
	export class KillResult {
	    pid: number;
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new KillResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pid = source["pid"];
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class ProcessInfo {
	    pid: number;
	    name: string;
	    cpu: number;
	    memMb: number;
	    status: string;
	    username: string;
	    uid: number;
	    isSystem: boolean;
	    cmdLine: string;
	
	    static createFrom(source: any = {}) {
	        return new ProcessInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pid = source["pid"];
	        this.name = source["name"];
	        this.cpu = source["cpu"];
	        this.memMb = source["memMb"];
	        this.status = source["status"];
	        this.username = source["username"];
	        this.uid = source["uid"];
	        this.isSystem = source["isSystem"];
	        this.cmdLine = source["cmdLine"];
	    }
	}
	export class ProcessResult {
	    userProcs: ProcessInfo[];
	    sysProcs: ProcessInfo[];
	
	    static createFrom(source: any = {}) {
	        return new ProcessResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.userProcs = this.convertValues(source["userProcs"], ProcessInfo);
	        this.sysProcs = this.convertValues(source["sysProcs"], ProcessInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ServiceInfo {
	    name: string;
	    loadState: string;
	    activeState: string;
	    subState: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new ServiceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.loadState = source["loadState"];
	        this.activeState = source["activeState"];
	        this.subState = source["subState"];
	        this.description = source["description"];
	    }
	}
	export class StartupApp {
	    name: string;
	    command: string;
	    comment: string;
	    icon: string;
	    enabled: boolean;
	    filePath: string;
	    userPath: string;
	    source: string;
	    isUserLevel: boolean;
	
	    static createFrom(source: any = {}) {
	        return new StartupApp(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.command = source["command"];
	        this.comment = source["comment"];
	        this.icon = source["icon"];
	        this.enabled = source["enabled"];
	        this.filePath = source["filePath"];
	        this.userPath = source["userPath"];
	        this.source = source["source"];
	        this.isUserLevel = source["isUserLevel"];
	    }
	}

}


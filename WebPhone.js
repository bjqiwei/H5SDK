(function () {
    window.WebPhone = window.WebPhone || {
            _version: "2.0.3.12",
            _thisPath: "",

            callid: null,
            audioRemote: null,

            oConfigCall: null,
            oSipStack: null,
            oSipSessionCall: null,
            oSipSessionTransferCall: null,
            oSipSessionRegister: null,
			loglevel:"debug",
			
			
			/**
			*设置日志级别
			* @param level:error,warn,info,debug
			**/
			setLogLevel:function(level)
			{
				if(level == "error" || level == "warn" || level == "info" || level == "debug"){
					loglevel = level;
				}
				else {
					window.console.error("set log level error, not recognize:"+level);
				}
			},
			
            /**
             * 初始化
             * @param s_webrtc_type
             * @param s_fps
             * @param s_mbwu maxBandwidthUp (kbps)
             * @param s_mbwd maxBandwidthUp (kbps)
             * @param s_za ZeroArtifacts
             * @param s_ndb NativeDebug
             */
            Init: function () {
				
				var audio = document.createElement("audio");
                //audio.setAttribute("id", "audio_remote");
                audio.setAttribute("autoplay", "true");
                document.body.appendChild(audio);
                this.audioRemote = audio;
				
                if (typeof(SIPml) == "undefined") {
					this.log("SIPml not init");
                    alert("SIPml not init");
                    return;
                }
                // set default webrtc type (before initialization)
                /*if (s_webrtc_type) {
                    SIPml.setWebRtcType(s_webrtc_type);
                }
				*/
                // initialize SIPML5
                SIPml.init(WebPhone.sipmlInit);
				/*
                // set other options after initialization
                if (s_fps) {
                    SIPml.setFps(parseFloat(s_fps));
                }
                if (s_mbwu) {
                    SIPml.setMaxBandwidthUp(parseFloat(s_mbwu));
                }
                if (s_mbwd) {
                    SIPml.setMaxBandwidthDown(parseFloat(s_mbwd));
                }
                if (s_za) {
                    SIPml.setZeroArtifacts(s_za === "true");
                }
                if (s_ndb == "true") {
                    SIPml.startNativeDebug();
                }
				*/
                this.log("init success");
            },
            /**
             * 作用：初始化SIPml
             */
            sipmlInit: function () {
                if (!SIPml.isWebRtcSupported()) {// check for WebRTC support
                    this.log("浏览器不支持webRTC");
                    return;
                }
                this.oConfigCall = {
                    audio_remote: this.audioRemote,
                    bandwidth: {audio: undefined},
                    events_listener: {events: '*', listener: this.onSipEventSession},
                    sip_caps: [
                        {name: '+g.oma.sip-im'},
                        {name: 'language', value: '\"en,fr\"'}
                    ]
                };
				return this.oConfigCall;
            },
            /**
             * 注册
             * @param txtRealm
             * @param sipid
             * @param sipurl
             * @param pwd
             * @param txtDisplayName
             * @param txtWebsocketUrl
             * @param txtICEServer
             */
            Login: function (txtRealm, sipid, sipurl, pwd, txtDisplayName, txtWebsocketUrl, txtICEServer) {
                // catch exception for IE (DOM not ready)
                try {
                    SIPml.setDebugLevel("info");
                    // enable notifications if not already done
                    if (window.webkitNotifications && window.webkitNotifications.checkPermission() != 0) {
                        window.webkitNotifications.requestPermission();
                    }
                    // create SIP stack
                    this.oSipStack = new SIPml.Stack({
                            realm: txtRealm,
                            impi: sipid,
                            impu: sipurl,
                            password: pwd,
                            display_name: txtDisplayName,
                            websocket_proxy_url: txtWebsocketUrl,
                            ice_servers: txtICEServer,
                            outbound_proxy_url: (null),
                            enable_rtcweb_breaker: (false),
                            events_listener: {events: '*', listener: WebPhone.onSipStackEvent},
                            enable_early_ims: (false), // Must be true unless you're using a real IMS network
                            enable_media_stream_cache: (false),
                            sip_headers: [
                                {name: 'User-Agent', value: 'html5_client'},
                                {name: 'Organization', value: 'Avaya'}
                            ]
                        }
                    );
                    var result = this.oSipStack.start();
                    if (result != 0) {
                        this.log('Failed to start the SIP stack')
                    }
                    return result;
                }
                catch (e) {
                    this.log(e);
                    return -1;
                }
            },
            // 注销
            Logout: function () {
                if (WebPhone.oSipStack) {
                    WebPhone.oSipStack.stop(); // shutdown all sessions
                }
                return 0;
            },
            /**
             * 获取版本号
             * @returns {string}
             */
            getVersion: function () {
                return WebPhone._version;
            },
            //呼叫
            MakeCall: function (called) {
                if (WebPhone.oSipStack && !WebPhone.oSipSessionCall && !tsk_string_is_null_or_empty(called)) {
                    // create call session
                    WebPhone.oSipSessionCall = WebPhone.oSipStack.newSession('call-audio', WebPhone.oConfigCall);
                    // make call
                    if (WebPhone.oSipSessionCall.call(called) != 0) {
                        WebPhone.oSipSessionCall = null;
                        WebPhone.log('Failed to make call');
                    }
                }
                else if (WebPhone.oSipSessionCall) {
                    WebPhone.log("Connecting");
                    WebPhone.oSipSessionCall.accept(WebPhone.oConfigCall);
                }
                return 0;
            },
            //摘机
            AnswerCall: function (callid) {
                if (WebPhone.oSipSessionCall) {
                    WebPhone.log('Connecting...');
                    WebPhone.oSipSessionCall.accept(WebPhone.oConfigCall);
                }
            },
            // 挂断 (SIP BYE or CANCEL)
            ClearCall: function (callid, reason) {
                if (WebPhone.oSipSessionCall) {
                    WebPhone.log('Terminating the call...');
                    WebPhone.oSipSessionCall.hangup({events_listener: {events: '*', listener: WebPhone.onSipEventSession}});
                }
                return 0;
            },
            //发送DTMF
            SendDTMF: function (callid, c) {
                if (WebPhone.oSipSessionCall && c) {
                    if (WebPhone.oSipSessionCall.dtmf(c) == 0) {
                        //try { dtmfTone.play(); } catch (e) { }
                    }
                }
            },
            // 呼转
            TransferCall: function (callid, s_destination) {
                if (WebPhone.oSipSessionCall) {
                    if (!tsk_string_is_null_or_empty(s_destination)) {
                        if (WebPhone.oSipSessionCall.transfer(s_destination) != 0) {
                            WebPhone.log('Call transfer failed');
                            return;
                        }
                        WebPhone.log('Transfering the call...');
                    }
                }
            },
            // 保持或恢复呼叫
            sipToggleHoldResume: function () {
                if (WebPhone.oSipSessionCall) {
                    var i_ret;
                    WebPhone.log(WebPhone.oSipSessionCall.bHeld ? 'Resuming the call...' : 'Holding the call...');
                    i_ret = WebPhone.oSipSessionCall.bHeld ? WebPhone.oSipSessionCall.resume() : WebPhone.oSipSessionCall.hold();
                    if (i_ret != 0) {
                        WebPhone.log('Hold / Resume failed');
                        return;
                    }
                }
            },
            /**
             * 保持
             * @param callid
             * @returns {number}
             * @constructor
             */
            HoldCall: function (callid) {
                if (WebPhone.oSipSessionCall) {
                    WebPhone.log(WebPhone.oSipSessionCall.bHeld ? 'Resuming the call...' : 'Holding the call...');
                    if (WebPhone.oSipSessionCall.bHeld) {
                        WebPhone.oSipSessionCall.hold();
                        return 0;
                    } else {
                        return 1;
                    }
                } else {
                    return 1;
                }
            },
            /**
             * 恢复
             * @param callid
             * @returns {number}
             * @constructor
             */
            RetrieveCall: function (callid) {
                if (WebPhone.oSipSessionCall) {
                    WebPhone.log(WebPhone.oSipSessionCall.bHeld ? 'Resuming the call...' : 'Holding the call...');
                    if (WebPhone.oSipSessionCall.bHeld) {
                        WebPhone.oSipSessionCall.resume();
                        return 0;
                    } else {
                        return 1;
                    }
                } else {
                    return 2;
                }
            },
            // 静音或恢复呼叫
            MuteCall: function () {
                if (WebPhone.oSipSessionCall) {
                    var i_ret;
                    var bMute = !WebPhone.oSipSessionCall.bMute;
                    WebPhone.log(bMute ? 'Mute the call...' : 'Unmute the call...');
                    i_ret = WebPhone.oSipSessionCall.mute('audio'/*could be 'video'*/, bMute);
                    if (i_ret != 0) {
                        WebPhone.log('Mute / Unmute failed');
                        return;
                    }
                    WebPhone.oSipSessionCall.bMute = bMute;
                }
            },

            /**
             * SIPml栈事件回调函数
             * @param e SIPml.Stack.Event
             */
            onSipStackEvent: function (e) {
                tsk_utils_log_info('==stack event = ' + e.type);
                WebPhone.log("收到Stack事件：" + e.type);
                switch (e.type) {
                    case 'started': //SIP栈开始工作
                    {
                        try {
                            WebPhone.oSipSessionRegister = WebPhone.oSipStack.newSession('register', {
                                expires: 200,
                                events_listener: {events: '*', listener: WebPhone.onSipEventSession},
                                sip_caps: [
                                    {name: '+g.oma.sip-im', value: null},
                                    //{ name: '+sip.ice' },
                                    {name: '+audio', value: null},
                                    {name: 'language', value: '\"en,fr\"'}
                                ]
                            });
                            WebPhone.oSipSessionRegister.register();
                        }
                        catch (e) {
                            WebPhone.log(e);
                        }
                        break;
                    }
                    case 'stopping':
                    case 'stopped':
                    case 'failed_to_start':
                    case 'failed_to_stop':
                    {
                        var bFailure = (e.type == 'failed_to_start') || (e.type == 'failed_to_stop');
                        WebPhone.oSipStack = null;
                        WebPhone.oSipSessionRegister = null;
                        WebPhone.oSipSessionCall = null;
						
						if (typeof(WebPhone.onConnectError) == "function") {
                            WebPhone.onConnectError(e.description);
                        }
                        WebPhone.log(bFailure ? "断开: <b>" + e.description + "</b>" : "Disconnected");
                        break;
                    }
                    case 'i_new_call':
                    {
                        if (WebPhone.oSipSessionCall) {
                            // do not accept the incoming call if we're already 'in call'
                            e.newSession.hangup(); // comment this line for multi-line support
                        } else {
                            WebPhone.oSipSessionCall = e.newSession;
                            // start listening for events
                            WebPhone.oSipSessionCall.setConfiguration(WebPhone.oConfigCall);
                            var sRemoteNumber = (WebPhone.oSipSessionCall.getRemoteFriendlyName() || 'unknown');
                            WebPhone.log("呼入号码为 [" + sRemoteNumber + "]");
                            if (typeof(WebPhone.onReceived) == "function") {
                                WebPhone.onReceived({"callid": null, "caller": sRemoteNumber});
                            }
                        }
                        break;
                    }
                    case 'm_permission_requested':
                    {
                        break;
                    }
                    case 'm_permission_accepted':
                    case 'm_permission_refused':
                    {
                        break;
                    }
                    case 'starting':
                    default:
                        break;
                }
            },
            /**
             * SIP请求回调函数 (INVITE, REGISTER, MESSAGE...)
             * @param e SIPml.Session.Event
             */
            onSipEventSession: function (e) {
                WebPhone.log("收到Session事件：" + e.type);
                switch (e.type) {
                    case 'connecting':
					{
						break;
					}
                    case 'connected':// 'connected'
                    {
                        if (typeof(WebPhone.onConnected) == "function") {
                              WebPhone.onConnected();
                        }
                        WebPhone.log(e.description);
                        break;
                    }
                    case 'terminating':
					{
						break;
					}
                    case 'terminated'://登出 // 'terminating' | 'terminated'
                    {
                        if (e.session == WebPhone.oSipSessionRegister) {
                            WebPhone.oSipSessionRegister = null;
                            WebPhone.log(e.description);
                        }
                        WebPhone.oSipSessionCall = null;
						if (typeof(WebPhone.onLogout) == "function") {
                                WebPhone.onLogout();
                        }
							
                        break;
                    }
                    case 'm_stream_audio_local_added':
                    case 'm_stream_audio_local_removed':
                    case 'm_stream_audio_remote_added':
                    case 'm_stream_audio_remote_removed':
                    {
                        break;
                    }
                    case 'i_ect_new_call':
                    {
                        WebPhone.oSipSessionTransferCall = e.session;
                        break;
                    }
                    case 'i_ao_request':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            var iSipResponseCode = e.getSipResponseCode();
                            if (iSipResponseCode == 100) {
                                if (typeof(WebPhone.onOriginated) == "function") {
                                    WebPhone.onOriginated({"callid": null});
                                }
                            }
                            if (iSipResponseCode == 180 || iSipResponseCode == 183) {
                                WebPhone.log('远端振铃...');
                                if (typeof(WebPhone.onDelivered) == "function") {
                                    WebPhone.onDelivered({"callid": null});
                                }
                            }
                            if (iSipResponseCode == 200) {
                                WebPhone.log("200");
                                if (typeof(WebPhone.onEstablished) == "function") {
                                    WebPhone.onEstablished({"callid": null});
                                }
                            }
                        }
                        break;
                    }
                    case 'm_early_media':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            WebPhone.log('早期媒体开始');
                        }
                        break;
                    }
                    case 'm_local_hold_ok':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
							if (typeof(WebPhone.onHeld) == "function") {
                                    WebPhone.onHeld({"callid": null});
                             }
                            WebPhone.log('通话保持');
                        }
                        break;
                    }
                    case 'm_local_hold_nok':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                             if (typeof(WebPhone.onHeldFailed) == "function") {
                                    WebPhone.onHeldFailed({"callid": null,"cause":"通话保持失败"});
                             }
                            WebPhone.log('通话保持失败');
                        }
                        break;
                    }
                    case 'm_local_resume_ok':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            if (typeof(WebPhone.onRetrieved) == "function") {
                                    WebPhone.onRetrieved({"callid": null,"cause":"通话恢复"});
                             }
                            WebPhone.log('通话恢复');
                        }
                        break;
                    }
                    case 'm_local_resume_nok':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            if (typeof(WebPhone.onRetrieveFailed) == "function") {
                                    WebPhone.onRetrieveFailed({"callid": null,"cause":"通话恢复失败"});
                            }
                            WebPhone.log('恢复通话失败');
                        }
                        break;
                    }
                    case 'm_remote_hold':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            WebPhone.log('远端通话保持');
                        }
                        break;
                    }
                    case 'm_remote_resume':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            WebPhone.log('远端恢复通话');
                        }
                        break;
                    }
                    case 'o_ect_trying':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            WebPhone.log('呼叫转接中...');
                        }
                        break;
                    }
                    case 'o_ect_accepted':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            WebPhone.log('呼叫转接接听');
                        }
                        break;
                    }
                    case 'o_ect_completed':
                    case 'i_ect_completed':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
							if (typeof(WebPhone.onTransferred) == "function") {
                                WebPhone.onTransferred({"callid": null,"cause":"呼叫转接结束"});
                            }
                            WebPhone.log('呼叫转接结束');
                        }
                        break;
                    }
                    case 'o_ect_failed':
                    case 'i_ect_failed'://转接失败
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
							if (typeof(WebPhone.onTransferFailed) == "function") {
                                WebPhone.onTransferFailed({"callid": null,"cause":"呼叫转接失败"});
                            }
                            WebPhone.log('呼叫转接失败');
                        }
                        break;
                    }
                    case 'o_ect_notify':
                    case 'i_ect_notify':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            WebPhone.log("转接: <b>" + e.getSipResponseCode() + " " + e.description + "</b>");
                            if (e.getSipResponseCode() >= 300) {
                                if (WebPhone.oSipSessionCall.bHeld) {
                                    WebPhone.oSipSessionCall.resume();
                                }
                            }
                        }
                        break;
                    }
                    case 'i_ect_requested':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            WebPhone.log("转接请求...");
                            var s_message = "是否转接到 [" + e.getTransferDestinationFriendlyName() + "]?";
                            //WebPhone.oSipSessionCall.acceptTransfer();
                            //WebPhone.oSipSessionCall.rejectTransfer();
                        }
                        break;
                    }
                }
                
            },
            /**
             * 返回当前日期+时间
             * @returns {string}
             */
            dateNow: function () {
                var date = new Date();
                var y = date.getFullYear();
                var m = date.getMonth() + 1;
                var d = date.getDate();
                var h = date.getHours();
                var mm = date.getMinutes();
                var s = date.getSeconds();
                var sss = date.getMilliseconds();
                if (m < 10) {
                    m = "0" + m
                }
                if (d < 10) {
                    d = "0" + d
                }
                if (h < 10) {
                    h = "0" + h
                }
                if (mm < 10) {
                    mm = "0" + mm
                }
                if (s < 10) {
                    s = "0" + s
                }
                return y + "-" + m + "-" + d + " " + h + ":" + mm + ":" + s + "." + sss;
            },
            /**
             * 日志
             * @returns {string}
             */
            log: function (c) {
                if (window.console && window.console.log) {
                    if (typeof(c) == "string") {
                        c = "[" + WebPhone.dateNow() + "] " + c;
                        window.console.log(c);
                    } else {
                        window.console.log(c);
                    }
                }
            },
            /**
             * 加载后自动调用
             */
            loading: function () {
                WebPhone.getPath();
                WebPhone.createScript(WebPhone._thisPath + "WebPhone-SIP.js");
            },
            /**
             * 获取本文件路径
             * @returns {string}
             */
            getPath: function () {
                if (!WebPhone._thisPath) {
                    var js = document.scripts;
                    for (var i = 0; i < js.length; i++) {
                        var script = js[i];
                        var jsPath = script.src;
                        if (jsPath.indexOf("WebPhone.js") != -1) {
                            WebPhone._thisPath = jsPath.substring(0, jsPath.lastIndexOf("/") + 1);
                        }
                    }
                }
                if (!WebPhone._thisPath) {
                    WebPhone._thisPath = "";
                }
                return WebPhone._thisPath;
            },

            /**
             * 创建script元素
             * @param filePath
             */
            createScript: function (filePath) {
                var tag = document.createElement("script");
                tag.setAttribute('type', 'text/javascript');
                tag.setAttribute('src', filePath);
                var head = document.getElementsByTagName("head");
                head.item(0).appendChild(tag);
            },
            /**
             * 生成uuid
             * @returns {*}
             */
            getUUID: function () {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            },
        }
    WebPhone.loading();
})();
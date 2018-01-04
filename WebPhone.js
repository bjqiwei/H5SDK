(function () {
    window.WebPhone = window.WebPhone || {
            _version: "2.0.3.21",
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
                WebPhone.debug("setLogLevel:"+level);
                if(level == "error" || level == "warn" || level == "info" || level == "debug"){
                    WebPhone.loglevel = level;
                    SIPml.setDebugLevel(WebPhone.loglevel);
                }
                else {
                    WebPhone.error("set log level error, not recognize:"+level);
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
                WebPhone.debug("Init:");
                WebPhone.info("WebPhone version=" + WebPhone._version);
                var audio = document.createElement("audio");
                //audio.setAttribute("id", "audio_remote");
                audio.setAttribute("autoplay", "true");
                document.body.appendChild(audio);
                WebPhone.audioRemote = audio;
                
                if (typeof(SIPml) == "undefined") {
                    WebPhone.error("SIPml not init");
                    alert("SIPml not init");
                    return;
                }
                // set default webrtc type (before initialization)
                /*if (s_webrtc_type) {
                    SIPml.setWebRtcType(s_webrtc_type);
                }
                */
                // initialize SIPML5
                SIPml.setDebugLevel(WebPhone.loglevel);
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
                WebPhone.info("init success");
            },
            /**
             * 作用：初始化SIPml
             */
            sipmlInit: function () {
                if (!SIPml.isWebRtcSupported()) {// check for WebRTC support
                    WebPhone.error("浏览器不支持webRTC");
                    return;
                }
                WebPhone.oConfigCall = {
                    audio_remote: WebPhone.audioRemote,
                    bandwidth: {audio: undefined},
                    events_listener: { events: '*', listener: WebPhone.onSipSessionEvent },
                    sip_caps: [
                        {name: '+g.oma.sip-im'},
                        {name: 'language', value: '\"en,fr\"'}
                    ]
                };
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
                WebPhone.debug("Login,Realm:" + txtRealm + ",SipID:" + sipid + ",SipUrl:" + sipurl + ",Pwd:" + pwd + ",DisplayName:" + txtDisplayName + ",WebSocketUrl:" + txtWebsocketUrl + ",ICEServer:" + txtICEServer);
                try {
                    SIPml.setDebugLevel("info");
                    // enable notifications if not already done
                    if (window.webkitNotifications && window.webkitNotifications.checkPermission() != 0) {
                        window.webkitNotifications.requestPermission();
                    }
                    // create SIP stack
                    WebPhone.oSipStack = new SIPml.Stack({
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
                    var result = WebPhone.oSipStack.start();
                    if (result != 0) {
                        WebPhone.error('Failed to start the SIP stack')
                    }
                    return result;
                }
                catch (e) {
                    WebPhone.error(e);
                    return -1;
                }
            },
            // 注销
            Logout: function () {
                WebPhone.debug("Logout:");
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
                WebPhone.debug("getVersion:");
                return WebPhone._version;
            },
            //呼叫
            MakeCall: function (called) {
                WebPhone.debug("MakeCall:" + called);
                if (WebPhone.oSipStack) {
                    // create call session
                    WebPhone.oSipSessionCall = WebPhone.oSipStack.newSession('call-audio', WebPhone.oConfigCall);
                    // make call
                    var err = WebPhone.oSipSessionCall.call(called);
                    if ( err != 0) {
                        WebPhone.oSipSessionCall = null;
                        WebPhone.error('Failed to make call');
                        if (typeof(WebPhone.onMakeCallFailed) == "function") {
                            var msg = {};
                            msg.reason = err;
                            msg.msg="make call failed";
                            WebPhone.onMakeCallFailed(msg);
                            WebPhone.debug("onMakeCallFailed:" + JSON.stringify(msg));
                            return err;
                        }
                    }
                }
                else if (typeof(WebPhone.onMakeCallFailed) == "function") {
                    var msg = {};
                    msg.reason = 1;
                    msg.msg="未注册";
                    WebPhone.onMakeCallFailed(msg);
                    WebPhone.debug("onMakeCallFailed:" + JSON.stringify(msg));
                    return 1;
                }
                return 0;
            },
            //摘机
            AnswerCall: function (callid) {
                WebPhone.debug("AnswerCall:" + callid);
                if (WebPhone.oSipSessionCall) {
                    WebPhone.debug('Connecting...');
                    WebPhone.oSipSessionCall.accept(WebPhone.oConfigCall);
                }
            },
            // 挂断 (SIP BYE or CANCEL)
            ClearCall: function (callid, reason) {
                WebPhone.debug("ClearCall, callid:" + callid + ",reason:" + reason);
                if (WebPhone.oSipSessionCall) {
                    WebPhone.debug('Terminating the call...');
                    WebPhone.oSipSessionCall.hangup({events_listener: {events: '*', listener: WebPhone.onSipSessionEvent}});
                }
                return 0;
            },
            //发送DTMF
            SendDTMF: function (callid, c) {
                var err = 1;
                if (WebPhone.oSipSessionCall && c) {
				    err = WebPhone.oSipSessionCall.dtmf(c);
                }
				WebPhone.debug("SendDTMF,callid:" + callid + ",c:" + c + ",result:" + err);
            },
            // 呼转
            TransferCall: function (callid, s_destination) {
                WebPhone.debug("TransferCall,callid:" + callid+ ",destination:" + s_destination);
                if (WebPhone.oSipSessionCall) {
                    
                    var err = WebPhone.oSipSessionCall.transfer(s_destination)
                    if(err != 0){ 
                        WebPhone.error('Call transfer failed:'+err);
                    }
                    else {
                        WebPhone.debug('Transfering the call...');
                    }
                    return err;
    
                }
                else{
                    WebPhone.error("TransferCall, the call is not exist.");
                    return 1;
                }
            },
            /**
             * 保持
             * @param callid
             * @returns {number}
             * @constructor
             */
            HoldCall: function (callid) {
                WebPhone.debug("HoldCall,callid:" + callid);
                if (WebPhone.oSipSessionCall) {
                    var err = WebPhone.oSipSessionCall.hold(WebPhone.oConfigCall);
                    WebPhone.debug('Holding the call...'+err);
                    return err;
                } else {
                    WebPhone.error("HoldCall, the call is not exist.");
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
                WebPhone.debug("RetrieveCall,callid:" + callid);
                if (WebPhone.oSipSessionCall) {
                    var err = WebPhone.oSipSessionCall.resume(WebPhone.oConfigCall);
                    WebPhone.debug('Retrieve the call...' + err);
                    return err;
                  
                } else {
                    WebPhone.error("RetrieveCall, the call is not exist.");
                    return 2;
                }
            },
            // 静音或恢复呼叫
            MuteCall: function () {
                if (WebPhone.oSipSessionCall) {
                    var i_ret;
                    var bMute = !WebPhone.oSipSessionCall.bMute;
                    WebPhone.info(bMute ? 'Mute the call...' : 'Unmute the call...');
                    i_ret = WebPhone.oSipSessionCall.mute('audio'/*could be 'video'*/, bMute);
                    if (i_ret != 0) {
                        WebPhone.error('Mute / Unmute failed');
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
                WebPhone.debug("收到Stack事件：" + e.type);
                switch (e.type) {
                    case 'started': //SIP栈开始工作
                    {
                        try {
                            WebPhone.oSipSessionRegister = WebPhone.oSipStack.newSession('register', {
                                expires: 200,
                                events_listener: {events: '*', listener: WebPhone.onSipSessionEvent},
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
                            WebPhone.warn(e);
                            if (typeof(WebPhone.onConnectError) == "function") {
                                var msg = {};
                                msg.reason = 500;
                                msg.msg = e.toString();
                                WebPhone.onConnectError(msg);
                                WebPhone.debug("onConnectError:" + JSON.stringify(msg));
                            }
                        }
                        break;
                    }
                    case 'stopping':
                    {
                        break;
                    }
                    case 'stopped':
                    {
                        if (WebPhone.oSipSessionRegister != null){
                        
                            if (typeof(WebPhone.onConnectError) == "function") {
                                var msg = {};
                                msg.reason = 506;
                                msg.msg = "network error";
                                WebPhone.onConnectError(msg);
                                WebPhone.debug("onConnectError:" + JSON.stringify(msg));
                            }
                        }
                        
                        WebPhone.oSipStack = null;
                        WebPhone.oSipSessionRegister = null;
                        WebPhone.oSipSessionCall = null;
                        break;
                    }
                    
                    case 'failed_to_start':
                    {
                        var bFailure = (e.type == 'failed_to_start') || (e.type == 'failed_to_stop');
                        
                        var msg = {};
                        msg.reason=504;
                        msg.msg = e.description
                        WebPhone.debug("onConnectError:" + JSON.stringify(msg));
                        if (e.session == WebPhone.oSipSessionRegister && typeof(WebPhone.onConnectError) == "function") {
                            WebPhone.onConnectError(msg);
                            WebPhone.error(e.description);
                        }
                        
                        WebPhone.oSipStack = null;
                        WebPhone.oSipSessionRegister = null;
                        WebPhone.oSipSessionCall = null;
                        break;
                    }
                    
                    case 'failed_to_stop':
                    {
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
                            var msg = {"callid": null, "caller": sRemoteNumber};
                            WebPhone.debug("onReceived:" + JSON.stringify(msg));
                            WebPhone.info("呼入号码为 [" + sRemoteNumber + "]");
                            if (typeof(WebPhone.onReceived) == "function") {
                                WebPhone.onReceived(msg);
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
            onSipSessionEvent: function (e) {
                WebPhone.debug("收到Session事件：" + e.type);
                switch (e.type) {
                    case 'connecting':
                    {
                        break;
                    }
                    case 'connected':// 'connected'
                    {
                        WebPhone.debug(e.description);
                        if (e.session == WebPhone.oSipSessionRegister) {
                            WebPhone.debug("onConnected:");
                            if(typeof(WebPhone.onConnected) == "function"){
                                WebPhone.onConnected();
                            }
                        }
                        else {
                            var msg = {};
                            msg.callid = null;
                            msg.msg = e.description;
                            WebPhone.debug("onEstablished:" + JSON.stringify(msg));
                            if (typeof(WebPhone.onEstablished) == "function"){
                                WebPhone.onEstablished(msg);
                            }
                        }
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
                            if(e.o_event.o_message.line.response.i_status_code != 200)
                            {
                                var msg = {};
                                msg.reason = e.o_event.o_message.line.response.i_status_code;
                                msg.msg = e.description;
                                WebPhone.debug("onConnectError:" + JSON.stringify(msg));
                                WebPhone.error("登录失败:" + e.o_event.o_message.line.response.i_status_code);
                                if (typeof(WebPhone.onConnectError) == "function") {
                                    WebPhone.onConnectError(msg);
                                }
                            }
                            else{
                                WebPhone.debug("onLogout:");
                                WebPhone.info("登出成功");
                                if (typeof(WebPhone.onLogout) == "function") {
                                    WebPhone.onLogout();
                                }
                            }
                            
                        }
                        
                        if (e.session == WebPhone.oSipSessionCall) {
                            WebPhone.oSipSessionCall = null;
                            if(typeof(WebPhone.onCallCleared) == "function"){
                                var msg ={};
                                msg.callid=null;
                                msg.msg = e.description;
                                msg.reason = 200;
                                try{
                                    msg.reason = e.o_event.o_message.line.response.i_status_code;
                                }
                                catch (e){
                                }
                                WebPhone.debug("onCallCleared:" + JSON.stringify(msg));
                                WebPhone.info("通话已挂断:" + msg.reason);
                                WebPhone.onCallCleared(msg);
                            }
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
                                var msg = {"callid": null};
                                WebPhone.debug("onOriginated:" + JSON.stringify(msg));
                                WebPhone.info("外呼中...");
                                if (typeof(WebPhone.onOriginated) == "function") {
                                    WebPhone.onOriginated(msg);
                                }
                            }
                            if (iSipResponseCode == 180 || iSipResponseCode == 183) {
                                var msg = {"callid": null};
                                WebPhone.debug("onDelivered:"+JSON.stringify(msg));
                                WebPhone.info('远端振铃...');
                                if (typeof(WebPhone.onDelivered) == "function") {
                                    WebPhone.onDelivered(msg);
                                }
                            }
                            if (iSipResponseCode == 200) {
                                var msg = {"callid": null};
                                WebPhone.debug("onEstablished:" + JSON.stringify(msg));
                                WebPhone.info("通话中");
                                if (typeof(WebPhone.onEstablished) == "function") {
                                    WebPhone.onEstablished(msg);
                                }
                            }
                        }
                        break;
                    }
                    case 'm_early_media':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            WebPhone.debug('远端振铃...');
                            var msg = {"callid": null};
                            WebPhone.debug("onDelivered:" + JSON.stringify(msg));
                            if (typeof(WebPhone.onDelivered) == "function") {
                                WebPhone.onDelivered(msg);
                            }
                        }
                        break;
                    }
                    case 'm_local_hold_ok':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            var msg = {"callid": null};
                            WebPhone.debug("onHeld:"+JSON.stringify(msg));
                            if (typeof(WebPhone.onHeld) == "function") {
                                    WebPhone.onHeld(msg);
                            }
                            WebPhone.debug('通话保持');
                        }
                        break;
                    }
                    case 'm_local_hold_nok':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            var msg = {"callid": null,reason:e.getSipResponseCode(),"msg":"通话保持失败"};
                            WebPhone.debug("onHeldFailed:"+JSON.stringify(msg));
                            if (typeof(WebPhone.onHeldFailed) == "function") {
                                WebPhone.onHeldFailed(msg);
                            }
                            WebPhone.error('通话保持失败');
                        }
                        break;
                    }
                    case 'm_local_resume_ok':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            var msg = {"callid": null,reason:e.getSipResponseCode(),"msg":"通话恢复"};
                            WebPhone.debug("onRetrieved:" + JSON.stringify(msg));
                            if (typeof(WebPhone.onRetrieved) == "function") {
                                    WebPhone.onRetrieved(msg);
                             }
                            WebPhone.debug('通话恢复');
                        }
                        break;
                    }
                    case 'm_local_resume_nok':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            var msg = {"callid": null,reason:e.getSipResponseCode(),"msg":"通话恢复失败"};
                            WebPhone.debug("onRetrieveFailed:"+msg);
                            if (typeof(WebPhone.onRetrieveFailed) == "function") {
                                    WebPhone.onRetrieveFailed(msg);
                            }
                            WebPhone.error('恢复通话失败');
                        }
                        break;
                    }
                    case 'm_remote_hold':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            WebPhone.info('远端通话保持');
                        }
                        break;
                    }
                    case 'm_remote_resume':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            WebPhone.info('远端恢复通话');
                        }
                        break;
                    }
                    case 'o_ect_trying':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            WebPhone.debug('呼叫转接中...');
                        }
                        break;
                    }
                    case 'o_ect_accepted':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            WebPhone.debug('呼叫转接接听');
                        }
                        break;
                    }
                    case 'o_ect_completed':
                    case 'i_ect_completed':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            var msg = {"callid": null};
                            WebPhone.debug("onTransferred:" + JSON.stringify(msg));
                            if (typeof(WebPhone.onTransferred) == "function") {
                                WebPhone.onTransferred(msg);
                            }
                            WebPhone.info('呼叫转接结束');
                        }
                        break;
                    }
                    case 'o_ect_failed':
                    case 'i_ect_failed'://转接失败
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            var msg = {"callid": null,reason:e.getSipResponseCode(),"msg":"呼叫转接失败"};
                            WebPhone.debug("onTransferFailed:" + JSON.stringify(msg));
                            if (typeof(WebPhone.onTransferFailed) == "function") {
                                WebPhone.onTransferFailed(msg);
                            }
                            WebPhone.error('呼叫转接失败');
                        }
                        break;
                    }
                    case 'o_ect_notify':
                    case 'i_ect_notify':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            WebPhone.debug("转接:" + e.getSipResponseCode() + " " + e.description);
                            var msg = {"callid": null};
                            WebPhone.debug("onTransferred:" + JSON.stringify(msg));
                            if (typeof(WebPhone.onTransferred) == "function") {
                                WebPhone.onTransferred(msg);
                            }
                        }
                        break;
                    }
                    case 'i_ect_requested':
                    {
                        if (e.session == WebPhone.oSipSessionCall) {
                            WebPhone.debug("转接请求...");
                            var s_message = "是否转接到 [" + e.getTransferDestinationFriendlyName() + "]?";
                            //WebPhone.oSipSessionCall.acceptTransfer();
                            //WebPhone.oSipSessionCall.rejectTransfer();
                        }
                        break;
                    }
					case "i_info":
					{
						if (e.session == WebPhone.oSipSessionCall) {
							if(e.getContentType() == "application/dtmf-relay"){
								var dtmf = e.getContentString(); //Signal=9
								dtmf = dtmf.substr(dtmf.indexOf("Signal=")+7,1);
								var msg = {"callid": null,"dtmf":dtmf};
								WebPhone.debug("onDtmfReceived:" + JSON.stringify(msg));
								if (typeof(WebPhone.onDtmfReceived) == "function") {
									WebPhone.onDtmfReceived(msg);
								}
							}
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
            debug: function (c) {
                if(WebPhone.loglevel == "debug"){
                    c = "[" + WebPhone.dateNow() + "] " + c;
                    window.console.debug(c);
                }
            },
            
            
            info: function (c) {
                if(WebPhone.loglevel == "debug" || WebPhone.loglevel == "info"){
                    c = "[" + WebPhone.dateNow() + "] " + c;
                    window.console.info(c);
                }
            },
            
            warn: function (c) {
                if(WebPhone.loglevel == "debug" || WebPhone.loglevel == "info"  || WebPhone.loglevel == "warn"){
                    c = "[" + WebPhone.dateNow() + "] " + c;
                    window.console.warn(c);
                }
            },
            
            error: function (c) {
                if(WebPhone.loglevel == "debug" || WebPhone.loglevel == "info"  || WebPhone.loglevel == "warn" || WebPhone.loglevel == "error" ){
                    c = "[" + WebPhone.dateNow() + "] " + c;
                    window.console.error(c);
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
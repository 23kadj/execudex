"share_with_app_devs":0,"is_first_party":0,"bug_type":"309","os_version":"iPhone OS 18.3.2 (22D82)","incident_id":"1C6830B1-D5D0-46E7-8210-EEA024F333FE","name":"Execudex","is_beta":1}
{
  "uptime" : 310000,
  "procRole" : "Foreground",
  "version" : 2,
  "userID" : 501,
  "deployVersion" : 210,
  "modelCode" : "iPhone14,7",
  "coalitionID" : 3777,
  "osVersion" : {
    "isEmbedded" : true,
    "train" : "iPhone OS 18.3.2",
    "releaseType" : "User",
    "build" : "22D82"
  },
  "captureTime" : "2025-12-15 22:16:26.2363 -0500",
  "codeSigningMonitor" : 2,
  "incident" : "1C6830B1-D5D0-46E7-8210-EEA024F333FE",
  "pid" : 72934,
  "translated" : false,
  "cpuType" : "ARM-64",
  "roots_installed" : 0,
  "bug_type" : "309",
  "procLaunch" : "2025-12-15 22:10:50.2847 -0500",
  "procStartAbsTime" : 7487468516252,
  "procExitAbsTime" : 7495531324986,
  "procName" : "Execudex",
  "procPath" : "\/private\/var\/containers\/Bundle\/Application\/354D1BE2-61D3-484C-8D15-6156F70923B0\/Execudex.app\/Execudex",
  "bundleInfo" : {"CFBundleShortVersionString":"1.0.0","CFBundleVersion":"15","CFBundleIdentifier":"com.execudex.app","DTAppStoreToolsBuild":"17C53"},
  "storeInfo" : {"itemID":"6754006135","storeCohortMetadata":"2|date=1765852200000&sf=143441&tid=34920f1ab4c5b20cc69694ef68e0c08a8d8999ddf209ce910fdcffbd6b1bf3e2&ttype=i","entitledBeta":true,"deviceIdentifierForVendor":"341B923D-C3BC-4018-A118-258F6233CF03","distributorID":"com.apple.TestFlight","softwareVersionExternalIdentifier":"192431834","applicationVariant":"1:iPhone14,7:18","thirdParty":true},
  "parentProc" : "launchd",
  "parentPid" : 1,
  "coalitionName" : "com.execudex.app",
  "isBeta" : 1,
  "appleIntelligenceStatus" : {"reasons":["notOptedIn","deviceNotCapable","siriAssetIsNotReady","unableToFetchAvailability","assetIsNotReady"],"state":"unavailable"},
  "wasUnlockedSinceBoot" : 1,
  "isLocked" : 0,
  "codeSigningID" : "com.execudex.app",
  "codeSigningTeamID" : "4LU748GLY7",
  "codeSigningFlags" : 570434305,
  "codeSigningValidationCategory" : 2,
  "codeSigningTrustLevel" : 4,
  "instructionByteStream" : {"beforePC":"ISAikeADE6oiAIBSVLf+l0AGADRgBkD5FSBMqb8CCOsiBgBU6AMVqg==","atPC":"AYUA+AhgAPno\/p9SKACgch+9QevgAQBU4AMTquEDFaoctf6XHwQAsQ=="},
  "bootSessionUUID" : "1B0DB3D6-A6A9-491E-A33C-E5024059B4AB",
  "basebandVersion" : "3.40.03",
  "vmRegionInfo" : "0x1 is not in any region.  Bytes before following region: 4343840767\n      REGION TYPE                 START - END      [ VSIZE] PRT\/MAX SHRMOD  REGION DETAIL\n      UNUSED SPACE AT START\n--->  \n      __TEXT                   102e9c000-102ea0000 [   16K] r-x\/r-x SM=COW  \/var\/containers\/Bundle\/Application\/354D1BE2-61D3-484C-8D15-6156F70923B0\/Execudex.app\/Execudex",
  "exception" : {"codes":"0x0000000000000001, 0x0000000000000001","rawCodes":[1,1],"type":"EXC_BAD_ACCESS","signal":"SIGSEGV","subtype":"KERN_INVALID_ADDRESS at 0x0000000000000001"},
  "termination" : {"flags":0,"code":11,"namespace":"SIGNAL","indicator":"Segmentation fault: 11","byProc":"exc handler","byPid":72934},
  "vmregioninfo" : "0x1 is not in any region.  Bytes before following region: 4343840767\n      REGION TYPE                 START - END      [ VSIZE] PRT\/MAX SHRMOD  REGION DETAIL\n      UNUSED SPACE AT START\n--->  \n      __TEXT                   102e9c000-102ea0000 [   16K] r-x\/r-x SM=COW  \/var\/containers\/Bundle\/Application\/354D1BE2-61D3-484C-8D15-6156F70923B0\/Execudex.app\/Execudex",
  "faultingThread" : 6,
  "threads" : [{"id":3801202,"threadState":{"x":[{"value":4392243584},{"value":4391542784},{"value":7186853888,"symbolLocation":0,"symbol":"dyld4::APIs::dyld_program_sdk_at_least(dyld_build_version_t)"},{"value":8379353056,"symbolLocation":616,"symbol":"vtable for dyld4::APIs"},{"value":0},{"value":0},{"value":1},{"value":2134414},{"value":0},{"value":8},{"value":393216},{"value":1099511627776},{"value":4294967293},{"value":0},{"value":0},{"value":0},{"value":11253088102294669280,"symbolLocation":11253088093915316840,"symbol":"vtable for dyld4::APIs"},{"value":600},{"value":0},{"value":6123027600},{"value":4392243584},{"value":4392243856},{"value":16465},{"value":12896814600},{"value":1},{"value":8298924307,"symbolLocation":99,"symbol":"ca_debug_options"},{"value":6123027624},{"value":6123032016},{"value":6123027696}],"flavor":"ARM_THREAD_STATE64","lr":{"value":13264426370448350140},"cpsr":{"value":1610616832},"fp":{"value":6123026928},"sp":{"value":6123026880},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":6574955420},"far":{"value":0}},"queue":"com.apple.main-thread","frames":[{"imageOffset":592796,"symbol":"CA::Layer::collect_layers_(CA::Layer::CollectLayersData*)","symbolLocation":244,"imageIndex":5},{"imageOffset":592828,"symbol":"CA::Layer::collect_layers_(CA::Layer::CollectLayersData*)","symbolLocation":276,"imageIndex":5},{"imageOffset":592828,"symbol":"CA::Layer::collect_layers_(CA::Layer::CollectLayersData*)","symbolLocation":276,"imageIndex":5},{"imageOffset":592828,"symbol":"CA::Layer::collect_layers_(CA::Layer::CollectLayersData*)","symbolLocation":276,"imageIndex":5},{"imageOffset":592828,"symbol":"CA::Layer::collect_layers_(CA::Layer::CollectLayersData*)","symbolLocation":276,"imageIndex":5},{"imageOffset":592828,"symbol":"CA::Layer::collect_layers_(CA::Layer::CollectLayersData*)","symbolLocation":276,"imageIndex":5},{"imageOffset":592828,"symbol":"CA::Layer::collect_layers_(CA::Layer::CollectLayersData*)","symbolLocation":276,"imageIndex":5},{"imageOffset":592828,"symbol":"CA::Layer::collect_layers_(CA::Layer::CollectLayersData*)","symbolLocation":276,"imageIndex":5},{"imageOffset":592828,"symbol":"CA::Layer::collect_layers_(CA::Layer::CollectLayersData*)","symbolLocation":276,"imageIndex":5},{"imageOffset":592828,"symbol":"CA::Layer::collect_layers_(CA::Layer::CollectLayersData*)","symbolLocation":276,"imageIndex":5},{"imageOffset":592828,"symbol":"CA::Layer::collect_layers_(CA::Layer::CollectLayersData*)","symbolLocation":276,"imageIndex":5},{"imageOffset":590872,"symbol":"CA::Layer::layout_if_needed(CA::Transaction*)","symbolLocation":368,"imageIndex":5},{"imageOffset":589860,"symbol":"CA::Layer::layout_and_display_if_needed(CA::Transaction*)","symbolLocation":148,"imageIndex":5},{"imageOffset":938180,"symbol":"CA::Context::commit_transaction(CA::Transaction*, double, double*)","symbolLocation":472,"imageIndex":5},{"imageOffset":376204,"symbol":"CA::Transaction::commit()","symbolLocation":648,"imageIndex":5},{"imageOffset":374680,"symbol":"CA::Transaction::flush_as_runloop_observer(bool)","symbolLocation":88,"imageIndex":5},{"imageOffset":652240,"symbol":"_UIApplicationFlushCATransaction","symbolLocation":52,"imageIndex":6},{"imageOffset":641180,"symbol":"__setupUpdateSequence_block_invoke_2","symbolLocation":332,"imageIndex":6},{"imageOffset":640784,"symbol":"_UIUpdateSequenceRun","symbolLocation":84,"imageIndex":6},{"imageOffset":651328,"symbol":"schedulerStepScheduledMainSection","symbolLocation":172,"imageIndex":6},{"imageOffset":642140,"symbol":"runloopSourceCallback","symbolLocation":92,"imageIndex":6},{"imageOffset":474956,"symbol":"__CFRUNLOOP_IS_CALLING_OUT_TO_A_SOURCE0_PERFORM_FUNCTION__","symbolLocation":28,"imageIndex":7},{"imageOffset":474848,"symbol":"__CFRunLoopDoSource0","symbolLocation":176,"imageIndex":7},{"imageOffset":486208,"symbol":"__CFRunLoopDoSources0","symbolLocation":244,"imageIndex":7},{"imageOffset":482620,"symbol":"__CFRunLoopRun","symbolLocation":840,"imageIndex":7},{"imageOffset":819844,"symbol":"CFRunLoopRunSpecific","symbolLocation":588,"imageIndex":7},{"imageOffset":5312,"symbol":"GSEventRunModal","symbolLocation":164,"imageIndex":8},{"imageOffset":4122228,"symbol":"-[UIApplication _run]","symbolLocation":816,"imageIndex":6},{"imageOffset":85640,"symbol":"UIApplicationMain","symbolLocation":340,"imageIndex":6},{"imageOffset":22048,"imageIndex":0},{"imageOffset":196072,"symbol":"start","symbolLocation":2724,"imageIndex":9}]},{"id":3805440,"threadState":{"x":[{"value":268451845},{"value":17297326606},{"value":0},{"value":73219},{"value":0},{"value":28600187224064},{"value":16384},{"value":0},{"value":18446744073709550527},{"value":16384},{"value":0},{"value":0},{"value":0},{"value":6659},{"value":1049137},{"value":1},{"value":18446744073709551569},{"value":8448681448},{"value":0},{"value":0},{"value":16384},{"value":28600187224064},{"value":0},{"value":73219},{"value":6124153472},{"value":0},{"value":17297326606},{"value":17297326606},{"value":117457422}],"flavor":"ARM_THREAD_STATE64","lr":{"value":7912898200},"cpsr":{"value":4096},"fp":{"value":6124153136},"sp":{"value":6124153056},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":7912884104},"far":{"value":0}},"queue":"AudioConverterPrepareQueue","frames":[{"imageOffset":6024,"symbol":"mach_msg2_trap","symbolLocation":8,"imageIndex":11},{"imageOffset":20120,"symbol":"mach_msg2_internal","symbolLocation":80,"imageIndex":11},{"imageOffset":19888,"symbol":"mach_msg_overwrite","symbolLocation":424,"imageIndex":11},{"imageOffset":19452,"symbol":"mach_msg","symbolLocation":24,"imageIndex":11},{"imageOffset":126796,"symbol":"_dispatch_mach_send_and_wait_for_reply","symbolLocation":544,"imageIndex":12},{"imageOffset":127724,"symbol":"dispatch_mach_send_with_result_and_wait_for_reply","symbolLocation":60,"imageIndex":12},{"imageOffset":67696,"symbol":"xpc_connection_send_message_with_reply_sync","symbolLocation":256,"imageIndex":13},{"imageOffset":30720,"symbol":"swix::connection::send_and_await_reply(swix::encode_message const&)","symbolLocation":280,"imageIndex":14},{"imageOffset":433124,"symbol":"__AudioConverterPrepare_block_invoke","symbolLocation":200,"imageIndex":15},{"imageOffset":8776,"symbol":"_dispatch_call_block_and_release","symbolLocation":32,"imageIndex":12},{"imageOffset":16296,"symbol":"_dispatch_client_callout","symbolLocation":20,"imageIndex":12},{"imageOffset":29788,"symbol":"_dispatch_continuation_pop","symbolLocation":596,"imageIndex":12},{"imageOffset":27424,"symbol":"_dispatch_async_redirect_invoke","symbolLocation":728,"imageIndex":12},{"imageOffset":89792,"symbol":"_dispatch_root_queue_drain","symbolLocation":392,"imageIndex":12},{"imageOffset":91844,"symbol":"_dispatch_worker_thread2","symbolLocation":156,"imageIndex":12},{"imageOffset":13892,"symbol":"_pthread_wqthread","symbolLocation":228,"imageIndex":16},{"imageOffset":5236,"symbol":"start_wqthread","symbolLocation":8,"imageIndex":16}]},{"id":3805441,"frames":[{"imageOffset":5228,"symbol":"start_wqthread","symbolLocation":0,"imageIndex":16}],"threadState":{"x":[{"value":6124744704},{"value":5379},{"value":6124208128},{"value":6124743552},{"value":5193734},{"value":1},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0}],"flavor":"ARM_THREAD_STATE64","lr":{"value":0},"cpsr":{"value":4096},"fp":{"value":0},"sp":{"value":6124743536},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":8875844716},"far":{"value":0}}},{"id":3805443,"threadState":{"x":[{"value":1},{"value":8},{"value":0},{"value":6125888047},{"value":0},{"value":0},{"value":6125888752},{"value":2720},{"value":4365387762},{"value":4357947392},{"value":4357947392},{"value":6125888376},{"value":100},{"value":456868},{"value":28448},{"value":456868},{"value":7186928264,"symbolLocation":0,"symbol":"invocation function for block in dyld3::MachOFile::forEachSection(void (dyld3::MachOFile::SectionInfo const&, bool, bool&) block_pointer) const"},{"value":7701436843906146960},{"value":0},{"value":4574203072},{"value":4358404260,"symbolLocation":0,"symbol":"RCTGetFatalHandler"},{"value":4574203088},{"value":6678858731},{"value":366},{"value":8758598211},{"value":4574203072},{"value":4573216784},{"value":64},{"value":576}],"flavor":"ARM_THREAD_STATE64","lr":{"value":13284008673151144604},"cpsr":{"value":2147487744},"fp":{"value":6125888960},"sp":{"value":6125888624},"esr":{"value":2449473543,"description":"(Data Abort) byte read Translation fault"},"pc":{"value":7187059388},"far":{"value":4365387762}},"queue":"com.meta.react.turbomodulemanager.queue","frames":[{"imageOffset":209596,"symbol":"dyld4::APIs::dladdr(void const*, dl_info*)","symbolLocation":268,"imageIndex":9},{"imageOffset":91644,"symbol":"backtrace_symbols","symbolLocation":144,"imageIndex":17},{"imageOffset":9092640,"symbol":"-[_NSCallStackArray objectAtIndex:]","symbolLocation":120,"imageIndex":18},{"imageOffset":3184016,"symbol":"facebook::react::TurboModuleConvertUtils::convertNSArrayToJSIArray(facebook::jsi::Runtime&, NSArray*)","symbolLocation":112,"imageIndex":1},{"imageOffset":3189552,"symbol":"facebook::react::TurboModuleConvertUtils::convertNSExceptionToJSError(facebook::jsi::Runtime&, NSException*, std::__1::basic_string<char, std::__1::char_traits<char>, std::__1::allocator<char>> const&, std::__1::basic_string<char, std::__1::char_traits<char>, std::__1::allocator<char>> const&)","symbolLocation":252,"imageIndex":1},{"imageOffset":3192228,"symbol":"invocation function for block in facebook::react::ObjCTurboModule::performVoidMethodInvocation(facebook::jsi::Runtime&, char const*, NSInvocation*, NSMutableArray*)","symbolLocation":328,"imageIndex":1},{"imageOffset":3212456,"symbol":"std::__1::__function::__func<facebook::react::ObjCTurboModule::performVoidMethodInvocation(facebook::jsi::Runtime&, char const*, NSInvocation*, NSMutableArray*)::$_1, std::__1::allocator<facebook::react::ObjCTurboModule::performVoidMethodInvocation(facebook::jsi::Runtime&, char const*, NSInvocation*, NSMutableArray*)::$_1>, void ()>::operator()()","symbolLocation":88,"imageIndex":1},{"imageOffset":8776,"symbol":"_dispatch_call_block_and_release","symbolLocation":32,"imageIndex":12},{"imageOffset":16296,"symbol":"_dispatch_client_callout","symbolLocation":20,"imageIndex":12},{"imageOffset":46540,"symbol":"_dispatch_lane_serial_drain","symbolLocation":768,"imageIndex":12},{"imageOffset":49444,"symbol":"_dispatch_lane_invoke","symbolLocation":380,"imageIndex":12},{"imageOffset":95116,"symbol":"_dispatch_root_queue_drain_deferred_wlh","symbolLocation":288,"imageIndex":12},{"imageOffset":93144,"symbol":"_dispatch_workloop_worker_thread","symbolLocation":540,"imageIndex":12},{"imageOffset":13952,"symbol":"_pthread_wqthread","symbolLocation":288,"imageIndex":16},{"imageOffset":5236,"symbol":"start_wqthread","symbolLocation":8,"imageIndex":16}]},{"id":3805444,"name":"com.apple.uikit.eventfetch-thread","threadState":{"x":[{"value":268451845},{"value":21592279046},{"value":8589934592},{"value":51689931407360},{"value":0},{"value":51689931407360},{"value":2},{"value":4294967295},{"value":18446744073709550527},{"value":2},{"value":0},{"value":0},{"value":0},{"value":12035},{"value":0},{"value":0},{"value":18446744073709551569},{"value":6678392336,"symbolLocation":56,"symbol":"clock_gettime"},{"value":0},{"value":4294967295},{"value":2},{"value":51689931407360},{"value":0},{"value":51689931407360},{"value":6126460280},{"value":8589934592},{"value":21592279046},{"value":21592279046},{"value":4412409862}],"flavor":"ARM_THREAD_STATE64","lr":{"value":7912898200},"cpsr":{"value":4096},"fp":{"value":6126460128},"sp":{"value":6126460048},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":7912884104},"far":{"value":0}},"frames":[{"imageOffset":6024,"symbol":"mach_msg2_trap","symbolLocation":8,"imageIndex":11},{"imageOffset":20120,"symbol":"mach_msg2_internal","symbolLocation":80,"imageIndex":11},{"imageOffset":19888,"symbol":"mach_msg_overwrite","symbolLocation":424,"imageIndex":11},{"imageOffset":19452,"symbol":"mach_msg","symbolLocation":24,"imageIndex":11},{"imageOffset":485380,"symbol":"__CFRunLoopServiceMachPort","symbolLocation":160,"imageIndex":7},{"imageOffset":482992,"symbol":"__CFRunLoopRun","symbolLocation":1212,"imageIndex":7},{"imageOffset":819844,"symbol":"CFRunLoopRunSpecific","symbolLocation":588,"imageIndex":7},{"imageOffset":172264,"symbol":"-[NSRunLoop(NSRunLoop) runMode:beforeDate:]","symbolLocation":212,"imageIndex":18},{"imageOffset":1600432,"symbol":"-[NSRunLoop(NSRunLoop) runUntilDate:]","symbolLocation":64,"imageIndex":18},{"imageOffset":4725368,"symbol":"-[UIEventFetcher threadMain]","symbolLocation":420,"imageIndex":6},{"imageOffset":1138480,"symbol":"__NSThread__start__","symbolLocation":724,"imageIndex":18},{"imageOffset":6096,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":16},{"imageOffset":5248,"symbol":"thread_start","symbolLocation":8,"imageIndex":16}]},{"id":3805446,"threadState":{"x":[{"value":4355785184},{"value":4355746056},{"value":4355935752},{"value":4391944192},{"value":4574203776},{"value":0},{"value":0},{"value":1027},{"value":4355735552},{"value":4355932160},{"value":114},{"value":88},{"value":88},{"value":12890917504},{"value":4355746056},{"value":8298102184,"symbolLocation":0,"symbol":"OBJC_CLASS_$_NSCoder"},{"value":6821150676,"symbolLocation":84,"symbol":"_xzm_xzone_chunk_madvise_free_slices"},{"value":6821150664,"symbolLocation":72,"symbol":"_xzm_xzone_chunk_madvise_free_slices"},{"value":0},{"value":4355935752},{"value":4355746056},{"value":4355735552},{"value":4355935760},{"value":4391944192},{"value":4355753848},{"value":6127612128},{"value":1},{"value":4355750192},{"value":114}],"flavor":"ARM_THREAD_STATE64","lr":{"value":6849003621528534060},"cpsr":{"value":2147488768},"fp":{"value":6127609072},"sp":{"value":6127609072},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":6821150676},"far":{"value":0}},"queue":"com.apple.NSXPCConnection.m-user.com.apple.audio.hapticd","frames":[{"imageOffset":16340,"symbol":"_xzm_xzone_chunk_madvise_free_slices","symbolLocation":84,"imageIndex":19},{"imageOffset":15404,"symbol":"_xzm_xzone_free_block_to_small_chunk","symbolLocation":284,"imageIndex":19},{"imageOffset":757392,"symbol":"-[NSXPCCoder dealloc]","symbolLocation":84,"imageIndex":18},{"imageOffset":757260,"symbol":"-[NSXPCDecoder dealloc]","symbolLocation":220,"imageIndex":18},{"imageOffset":20024,"symbol":"AutoreleasePoolPage::releaseUntil(objc_object**)","symbolLocation":204,"imageIndex":20},{"imageOffset":19340,"symbol":"objc_autoreleasePoolPop","symbolLocation":260,"imageIndex":20},{"imageOffset":760056,"symbol":"__88-[NSXPCConnection _sendInvocation:orArguments:count:methodSignature:selector:withProxy:]_block_invoke_5","symbolLocation":1144,"imageIndex":18},{"imageOffset":129920,"symbol":"_xpc_connection_reply_callout","symbolLocation":116,"imageIndex":13},{"imageOffset":74448,"symbol":"_xpc_connection_call_reply_async","symbolLocation":80,"imageIndex":13},{"imageOffset":16424,"symbol":"_dispatch_client_callout3","symbolLocation":20,"imageIndex":12},{"imageOffset":138084,"symbol":"_dispatch_mach_msg_async_reply_invoke","symbolLocation":340,"imageIndex":12},{"imageOffset":46124,"symbol":"_dispatch_lane_serial_drain","symbolLocation":352,"imageIndex":12},{"imageOffset":49496,"symbol":"_dispatch_lane_invoke","symbolLocation":432,"imageIndex":12},{"imageOffset":95116,"symbol":"_dispatch_root_queue_drain_deferred_wlh","symbolLocation":288,"imageIndex":12},{"imageOffset":93144,"symbol":"_dispatch_workloop_worker_thread","symbolLocation":540,"imageIndex":12},{"imageOffset":13952,"symbol":"_pthread_wqthread","symbolLocation":288,"imageIndex":16},{"imageOffset":5236,"symbol":"start_wqthread","symbolLocation":8,"imageIndex":16}]},{"triggered":true,"id":3805447,"name":"com.facebook.react.runtime.JavaScript","threadState":{"x":[{"value":6125888872},{"value":18445899653220418304},{"value":1},{"value":18446462603173857936},{"value":18445055223849287680},{"value":18446462603283943032},{"value":6128175864},{"value":6128177072},{"value":1},{"value":1},{"value":18445618173802708993},{"value":4384458440},{"value":18445899653220418304},{"value":4384458416},{"value":1},{"value":4437000644},{"value":0},{"value":12544},{"value":0},{"value":4393697280},{"value":6128176816},{"value":1},{"value":18445055223849287680},{"value":4442844671},{"value":4384458304},{"value":4384458304},{"value":4393697280},{"value":0},{"value":12925358144}],"flavor":"ARM_THREAD_STATE64","lr":{"value":4371648968},"cpsr":{"value":2147487744},"fp":{"value":6128176800},"sp":{"value":6128176768},"esr":{"value":2449473606,"description":"(Data Abort) byte write Translation fault"},"pc":{"value":4371648992,"matchesCrashFrame":1},"far":{"value":1}},"frames":[{"imageOffset":692704,"symbol":"hermes::vm::objectPrototypeHasOwnProperty(void*, hermes::vm::Runtime&, hermes::vm::NativeArgs)","symbolLocation":88,"imageIndex":3},{"imageOffset":156064,"symbol":"hermes::vm::NativeFunction::_nativeCall(hermes::vm::NativeFunction*, hermes::vm::Runtime&)","symbolLocation":140,"imageIndex":3},{"imageOffset":746092,"symbol":"hermes::vm::functionPrototypeCall(void*, hermes::vm::Runtime&, hermes::vm::NativeArgs)","symbolLocation":300,"imageIndex":3},{"imageOffset":156064,"symbol":"hermes::vm::NativeFunction::_nativeCall(hermes::vm::NativeFunction*, hermes::vm::Runtime&)","symbolLocation":140,"imageIndex":3},{"imageOffset":207144,"symbol":"hermes::vm::Interpreter::handleCallSlowPath(hermes::vm::Runtime&, hermes::vm::PinnedHermesValue*)","symbolLocation":60,"imageIndex":3},{"imageOffset":213272,"symbol":"hermes::vm::CallResult<hermes::vm::HermesValue, (hermes::vm::detail::CallResultSpecialize)2> hermes::vm::Interpreter::interpretFunction<false, false>(hermes::vm::Runtime&, hermes::vm::InterpreterState&)","symbolLocation":1992,"imageIndex":3},{"imageOffset":211240,"symbol":"hermes::vm::Runtime::interpretFunctionImpl(hermes::vm::CodeBlock*)","symbolLocation":52,"imageIndex":3},{"imageOffset":156296,"symbol":"hermes::vm::JSFunction::_callImpl(hermes::vm::Handle<hermes::vm::Callable>, hermes::vm::Runtime&)","symbolLocation":40,"imageIndex":3},{"imageOffset":152200,"symbol":"hermes::vm::Callable::executeCall(hermes::vm::Handle<hermes::vm::Callable>, hermes::vm::Runtime&, hermes::vm::Handle<hermes::vm::HermesValue>, hermes::vm::Handle<hermes::vm::HermesValue>, hermes::vm::Handle<hermes::vm::JSObject>)","symbolLocation":1028,"imageIndex":3},{"imageOffset":745460,"symbol":"hermes::vm::functionPrototypeApply(void*, hermes::vm::Runtime&, hermes::vm::NativeArgs)","symbolLocation":344,"imageIndex":3},{"imageOffset":156064,"symbol":"hermes::vm::NativeFunction::_nativeCall(hermes::vm::NativeFunction*, hermes::vm::Runtime&)","symbolLocation":140,"imageIndex":3},{"imageOffset":207144,"symbol":"hermes::vm::Interpreter::handleCallSlowPath(hermes::vm::Runtime&, hermes::vm::PinnedHermesValue*)","symbolLocation":60,"imageIndex":3},{"imageOffset":213272,"symbol":"hermes::vm::CallResult<hermes::vm::HermesValue, (hermes::vm::detail::CallResultSpecialize)2> hermes::vm::Interpreter::interpretFunction<false, false>(hermes::vm::Runtime&, hermes::vm::InterpreterState&)","symbolLocation":1992,"imageIndex":3},{"imageOffset":211240,"symbol":"hermes::vm::Runtime::interpretFunctionImpl(hermes::vm::CodeBlock*)","symbolLocation":52,"imageIndex":3},{"imageOffset":156296,"symbol":"hermes::vm::JSFunction::_callImpl(hermes::vm::Handle<hermes::vm::Callable>, hermes::vm::Runtime&)","symbolLocation":40,"imageIndex":3},{"imageOffset":150136,"symbol":"hermes::vm::Callable::executeCall0(hermes::vm::Handle<hermes::vm::Callable>, hermes::vm::Runtime&, hermes::vm::Handle<hermes::vm::HermesValue>, bool)","symbolLocation":156,"imageIndex":3},{"imageOffset":405724,"symbol":"hermes::vm::Runtime::drainJobs()","symbolLocation":240,"imageIndex":3},{"imageOffset":33560,"symbol":"facebook::hermes::(anonymous namespace)::HermesRuntimeImpl::drainMicrotasks(int)","symbolLocation":36,"imageIndex":3},{"imageOffset":2515208,"symbol":"facebook::react::RuntimeScheduler_Modern::performMicrotaskCheckpoint(facebook::jsi::Runtime&)","symbolLocation":108,"imageIndex":1},{"imageOffset":2514848,"symbol":"facebook::react::RuntimeScheduler_Modern::runEventLoopTick(facebook::jsi::Runtime&, facebook::react::Task&)","symbolLocation":172,"imageIndex":1},{"imageOffset":2514196,"symbol":"facebook::react::RuntimeScheduler_Modern::runEventLoop(facebook::jsi::Runtime&)","symbolLocation":96,"imageIndex":1},{"imageOffset":2666644,"symbol":"_ZNSt3__110__function6__funcIZZN8facebook5react13ReactInstanceC1ENS_10unique_ptrINS3_9JSRuntimeENS_14default_deleteIS6_EEEENS_10shared_ptrINS3_18MessageQueueThreadEEENSA_INS3_12TimerManagerEEENS_8functionIFvRNS2_3jsi7RuntimeERKNS3_14JsErrorHandler14ProcessedErrorEEEEPNS3_18jsinspector_modern10HostTargetEENK3$_0clINSF_IFvSI_EEEEEDaT_EUlvE_NS_9allocatorISY_EEFvvEEclEv","symbolLocation":116,"imageIndex":1},{"imageOffset":677336,"symbol":"facebook::react::tryAndReturnError(std::__1::function<void ()> const&)","symbolLocation":32,"imageIndex":1},{"imageOffset":656736,"symbol":"facebook::react::RCTMessageThread::tryFunc(std::__1::function<void ()> const&)","symbolLocation":24,"imageIndex":1},{"imageOffset":656228,"symbol":"invocation function for block in facebook::react::RCTMessageThread::runAsync(std::__1::function<void ()>)","symbolLocation":44,"imageIndex":1},{"imageOffset":499088,"symbol":"__CFRUNLOOP_IS_CALLING_OUT_TO_A_BLOCK__","symbolLocation":28,"imageIndex":7},{"imageOffset":485008,"symbol":"__CFRunLoopDoBlocks","symbolLocation":356,"imageIndex":7},{"imageOffset":484212,"symbol":"__CFRunLoopRun","symbolLocation":2432,"imageIndex":7},{"imageOffset":819844,"symbol":"CFRunLoopRunSpecific","symbolLocation":588,"imageIndex":7},{"imageOffset":2756372,"symbol":"+[RCTJSThreadManager runRunLoop]","symbolLocation":252,"imageIndex":1},{"imageOffset":1138480,"symbol":"__NSThread__start__","symbolLocation":724,"imageIndex":18},{"imageOffset":6096,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":16},{"imageOffset":5248,"symbol":"thread_start","symbolLocation":8,"imageIndex":16}]},{"id":3805448,"name":"hades","threadState":{"x":[{"value":260},{"value":0},{"value":0},{"value":0},{"value":0},{"value":160},{"value":0},{"value":0},{"value":6128758440},{"value":0},{"value":0},{"value":2},{"value":2},{"value":0},{"value":0},{"value":0},{"value":305},{"value":8447916352},{"value":0},{"value":12938065664},{"value":12938065728},{"value":6128759008},{"value":0},{"value":0},{"value":0},{"value":1},{"value":256},{"value":0},{"value":0}],"flavor":"ARM_THREAD_STATE64","lr":{"value":8875855768},"cpsr":{"value":1610616832},"fp":{"value":6128758560},"sp":{"value":6128758416},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":7912906896},"far":{"value":0}},"frames":[{"imageOffset":28816,"symbol":"__psynch_cvwait","symbolLocation":8,"imageIndex":11},{"imageOffset":16280,"symbol":"_pthread_cond_wait","symbolLocation":1204,"imageIndex":16},{"imageOffset":136580,"symbol":"std::__1::condition_variable::wait(std::__1::unique_lock<std::__1::mutex>&)","symbolLocation":28,"imageIndex":21},{"imageOffset":850372,"symbol":"hermes::vm::HadesGC::Executor::worker()","symbolLocation":116,"imageIndex":3},{"imageOffset":850220,"symbol":"void* std::__1::__thread_proxy[abi:nn180100]<std::__1::tuple<std::__1::unique_ptr<std::__1::__thread_struct, std::__1::default_delete<std::__1::__thread_struct>>, hermes::vm::HadesGC::Executor::Executor()::'lambda'()>>(void*)","symbolLocation":44,"imageIndex":3},{"imageOffset":6096,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":16},{"imageOffset":5248,"symbol":"thread_start","symbolLocation":8,"imageIndex":16}]},{"id":3805451,"frames":[{"imageOffset":29360,"symbol":"__semwait_signal","symbolLocation":8,"imageIndex":11},{"imageOffset":99788,"symbol":"nanosleep","symbolLocation":220,"imageIndex":17},{"imageOffset":99396,"symbol":"sleep","symbolLocation":52,"imageIndex":17},{"imageOffset":3870808,"imageIndex":0},{"imageOffset":6096,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":16},{"imageOffset":5248,"symbol":"thread_start","symbolLocation":8,"imageIndex":16}],"threadState":{"x":[{"value":4},{"value":0},{"value":1},{"value":1},{"value":60},{"value":0},{"value":52},{"value":0},{"value":8298008936,"symbolLocation":0,"symbol":"clock_sem"},{"value":16387},{"value":17},{"value":1440},{"value":2043},{"value":2045},{"value":2869116939},{"value":2867017738},{"value":334},{"value":11},{"value":0},{"value":6129330976},{"value":6129330992},{"value":4353392640,"symbolLocation":1040,"symbol":"guard variable for facebook::react::ConcreteShadowNode<&facebook::react::RNSentryReplayUnmaskComponentName, facebook::react::YogaLayoutableShadowNode, facebook::react::RNSentryReplayUnmaskProps, facebook::react::RNSentryReplayUnmaskEventEmitter, facebook::react::StateData>::defaultSharedProps()::defaultSharedProps"},{"value":515},{"value":4353513192},{"value":4353511424},{"value":4353511424},{"value":0},{"value":4353511424},{"value":0}],"flavor":"ARM_THREAD_STATE64","lr":{"value":6678451660},"cpsr":{"value":1610616832},"fp":{"value":6129330960},"sp":{"value":6129330912},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":7912907440},"far":{"value":0}}},{"id":3805452,"name":"SentryCrash Exception Handler (Secondary)","threadState":{"x":[{"value":268451845},{"value":17179869186},{"value":0},{"value":0},{"value":0},{"value":140767553126400},{"value":580},{"value":0},{"value":18446744073709550527},{"value":580},{"value":0},{"value":0},{"value":0},{"value":32775},{"value":0},{"value":0},{"value":18446744073709551569},{"value":6129905664},{"value":0},{"value":0},{"value":580},{"value":140767553126400},{"value":0},{"value":0},{"value":6129904964},{"value":0},{"value":17179869186},{"value":17179869186},{"value":2}],"flavor":"ARM_THREAD_STATE64","lr":{"value":7912898200},"cpsr":{"value":4096},"fp":{"value":6129903328},"sp":{"value":6129903248},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":7912884104},"far":{"value":0}},"frames":[{"imageOffset":6024,"symbol":"mach_msg2_trap","symbolLocation":8,"imageIndex":11},{"imageOffset":20120,"symbol":"mach_msg2_internal","symbolLocation":80,"imageIndex":11},{"imageOffset":19888,"symbol":"mach_msg_overwrite","symbolLocation":424,"imageIndex":11},{"imageOffset":19452,"symbol":"mach_msg","symbolLocation":24,"imageIndex":11},{"imageOffset":3911676,"imageIndex":0},{"imageOffset":6096,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":16},{"imageOffset":5248,"symbol":"thread_start","symbolLocation":8,"imageIndex":16}]},{"id":3805454,"name":"io.sentry.app-hang-tracker","threadState":{"x":[{"value":4},{"value":0},{"value":1},{"value":1},{"value":0},{"value":400000000},{"value":0},{"value":0},{"value":8298008936,"symbolLocation":0,"symbol":"clock_sem"},{"value":3},{"value":17},{"value":1970337767848192},{"value":4},{"value":12930873648},{"value":8298103984,"symbolLocation":0,"symbol":"OBJC_METACLASS_$_NSThread"},{"value":8298103984,"symbolLocation":0,"symbol":"OBJC_METACLASS_$_NSThread"},{"value":334},{"value":8447913440},{"value":0},{"value":0},{"value":6131051520},{"value":12892922352},{"value":6131051720},{"value":10431256776,"symbolLocation":0,"symbol":"_NSConcreteStackBlock"},{"value":4347635876},{"value":4352428672},{"value":13681320828887552712},{"value":12892922336},{"value":0}],"flavor":"ARM_THREAD_STATE64","lr":{"value":6678451660},"cpsr":{"value":2684358656},"fp":{"value":6131051472},"sp":{"value":6131051424},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":7912907440},"far":{"value":0}},"frames":[{"imageOffset":29360,"symbol":"__semwait_signal","symbolLocation":8,"imageIndex":11},{"imageOffset":99788,"symbol":"nanosleep","symbolLocation":220,"imageIndex":17},{"imageOffset":9093800,"symbol":"+[NSThread sleepForTimeInterval:]","symbolLocation":160,"imageIndex":18},{"imageOffset":3794500,"imageIndex":0},{"imageOffset":1138480,"symbol":"__NSThread__start__","symbolLocation":724,"imageIndex":18},{"imageOffset":6096,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":16},{"imageOffset":5248,"symbol":"thread_start","symbolLocation":8,"imageIndex":16}]},{"id":3805461,"name":"com.apple.NSURLConnectionLoader","threadState":{"x":[{"value":268451845},{"value":21592279046},{"value":8589934592},{"value":270509925203968},{"value":0},{"value":270509925203968},{"value":2},{"value":4294967295},{"value":18446744073709550527},{"value":2},{"value":0},{"value":0},{"value":0},{"value":62983},{"value":1792},{"value":0},{"value":18446744073709551569},{"value":6678392336,"symbolLocation":56,"symbol":"clock_gettime"},{"value":0},{"value":4294967295},{"value":2},{"value":270509925203968},{"value":0},{"value":270509925203968},{"value":6132768056},{"value":8589934592},{"value":21592279046},{"value":21592279046},{"value":4412409862}],"flavor":"ARM_THREAD_STATE64","lr":{"value":7912898200},"cpsr":{"value":4096},"fp":{"value":6132767904},"sp":{"value":6132767824},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":7912884104},"far":{"value":0}},"frames":[{"imageOffset":6024,"symbol":"mach_msg2_trap","symbolLocation":8,"imageIndex":11},{"imageOffset":20120,"symbol":"mach_msg2_internal","symbolLocation":80,"imageIndex":11},{"imageOffset":19888,"symbol":"mach_msg_overwrite","symbolLocation":424,"imageIndex":11},{"imageOffset":19452,"symbol":"mach_msg","symbolLocation":24,"imageIndex":11},{"imageOffset":485380,"symbol":"__CFRunLoopServiceMachPort","symbolLocation":160,"imageIndex":7},{"imageOffset":482992,"symbol":"__CFRunLoopRun","symbolLocation":1212,"imageIndex":7},{"imageOffset":819844,"symbol":"CFRunLoopRunSpecific","symbolLocation":588,"imageIndex":7},{"imageOffset":990284,"symbol":"+[__CFN_CoreSchedulingSetRunnable _run:]","symbolLocation":416,"imageIndex":22},{"imageOffset":1138480,"symbol":"__NSThread__start__","symbolLocation":724,"imageIndex":18},{"imageOffset":6096,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":16},{"imageOffset":5248,"symbol":"thread_start","symbolLocation":8,"imageIndex":16}]},{"id":3805796,"frames":[{"imageOffset":5228,"symbol":"start_wqthread","symbolLocation":0,"imageIndex":16}],"threadState":{"x":[{"value":6123597824},{"value":4963},{"value":6123061248},{"value":0},{"value":409604},{"value":18446744073709551615},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0}],"flavor":"ARM_THREAD_STATE64","lr":{"value":0},"cpsr":{"value":4096},"fp":{"value":0},"sp":{"value":6123597824},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":8875844716},"far":{"value":0}}},{"id":3805820,"frames":[{"imageOffset":5228,"symbol":"start_wqthread","symbolLocation":0,"imageIndex":16}],"threadState":{"x":[{"value":6125318144},{"value":79619},{"value":6124781568},{"value":0},{"value":409604},{"value":18446744073709551615},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0}],"flavor":"ARM_THREAD_STATE64","lr":{"value":0},"cpsr":{"value":4096},"fp":{"value":0},"sp":{"value":6125318144},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":8875844716},"far":{"value":0}}},{"id":3805822,"name":"AudioSession - RootQueue","threadState":{"x":[{"value":14},{"value":4294966759129088004},{"value":999999875},{"value":68719460488},{"value":12925444096},{"value":0},{"value":0},{"value":0},{"value":999999875},{"value":12297829382473034411},{"value":13835058055282163714},{"value":80000000},{"value":2043},{"value":2045},{"value":3300933734},{"value":3298834600},{"value":18446744073709551578},{"value":102},{"value":0},{"value":7495649763626},{"value":4452860480},{"value":1000000000},{"value":6127038688},{"value":0},{"value":0},{"value":18446744071427850239},{"value":0},{"value":0},{"value":0}],"flavor":"ARM_THREAD_STATE64","lr":{"value":6678083008},"cpsr":{"value":2147487744},"fp":{"value":6127038272},"sp":{"value":6127038240},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":7912883996},"far":{"value":0}},"frames":[{"imageOffset":5916,"symbol":"semaphore_timedwait_trap","symbolLocation":8,"imageIndex":11},{"imageOffset":17856,"symbol":"_dispatch_sema4_timedwait","symbolLocation":64,"imageIndex":12},{"imageOffset":19392,"symbol":"_dispatch_semaphore_wait_slow","symbolLocation":76,"imageIndex":12},{"imageOffset":89236,"symbol":"_dispatch_worker_thread","symbolLocation":324,"imageIndex":12},{"imageOffset":6096,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":16},{"imageOffset":5248,"symbol":"thread_start","symbolLocation":8,"imageIndex":16}]}],
  "usedImages" : [
  {
    "source" : "P",
    "arch" : "arm64",
    "base" : 4343840768,
    "size" : 8536064,
    "uuid" : "c7826145-16a9-3afa-8771-5f7354bd2ed4",
    "path" : "\/private\/var\/containers\/Bundle\/Application\/354D1BE2-61D3-484C-8D15-6156F70923B0\/Execudex.app\/Execudex",
    "name" : "Execudex"
  },
  {
    "source" : "P",
    "arch" : "arm64",
    "base" : 4357947392,
    "size" : 4440064,
    "uuid" : "76fbcee9-3517-30b3-9dc6-62c4e914e908",
    "path" : "\/private\/var\/containers\/Bundle\/Application\/354D1BE2-61D3-484C-8D15-6156F70923B0\/Execudex.app\/Frameworks\/React.framework\/React",
    "name" : "React"
  },
  {
    "source" : "P",
    "arch" : "arm64",
    "base" : 4369547264,
    "size" : 557056,
    "uuid" : "b35f1182-b82e-3372-8a74-a4fe502c0906",
    "path" : "\/private\/var\/containers\/Bundle\/Application\/354D1BE2-61D3-484C-8D15-6156F70923B0\/Execudex.app\/Frameworks\/ReactNativeDependencies.framework\/ReactNativeDependencies",
    "name" : "ReactNativeDependencies"
  },
  {
    "source" : "P",
    "arch" : "arm64",
    "base" : 4370956288,
    "size" : 2113536,
    "uuid" : "80d5528f-2c78-3b90-b90f-747e89a9f880",
    "path" : "\/private\/var\/containers\/Bundle\/Application\/354D1BE2-61D3-484C-8D15-6156F70923B0\/Execudex.app\/Frameworks\/hermes.framework\/hermes",
    "name" : "hermes"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 4384227328,
    "size" : 49152,
    "uuid" : "4aba9420-e4d0-3c98-9d62-c653b259eab4",
    "path" : "\/private\/preboot\/Cryptexes\/OS\/usr\/lib\/libobjc-trampolines.dylib",
    "name" : "libobjc-trampolines.dylib"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 6574362624,
    "size" : 3854336,
    "uuid" : "8a08cc24-0017-3108-bea4-29111b40063c",
    "path" : "\/System\/Library\/Frameworks\/QuartzCore.framework\/QuartzCore",
    "name" : "QuartzCore"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 6588301312,
    "size" : 32608256,
    "uuid" : "8cc54497-f7ec-3903-ae5a-a274047c0cf1",
    "path" : "\/System\/Library\/PrivateFrameworks\/UIKitCore.framework\/UIKitCore",
    "name" : "UIKitCore"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 6546214912,
    "size" : 5521408,
    "uuid" : "0013a8b1-2524-3534-b5ba-681aaf18c798",
    "path" : "\/System\/Library\/Frameworks\/CoreFoundation.framework\/CoreFoundation",
    "name" : "CoreFoundation"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 7841431552,
    "size" : 36864,
    "uuid" : "3eca7962-867b-3029-adc8-bbe100f85ba5",
    "path" : "\/System\/Library\/PrivateFrameworks\/GraphicsServices.framework\/GraphicsServices",
    "name" : "GraphicsServices"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 7186849792,
    "size" : 536888,
    "uuid" : "a770ff8c-8fb9-3e03-85fe-7f26db36812b",
    "path" : "\/usr\/lib\/dyld",
    "name" : "dyld"
  },
  {
    "size" : 0,
    "source" : "A",
    "base" : 0,
    "uuid" : "00000000-0000-0000-0000-000000000000"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 7912878080,
    "size" : 237540,
    "uuid" : "881fe934-759c-3089-b986-60344cb843e3",
    "path" : "\/usr\/lib\/system\/libsystem_kernel.dylib",
    "name" : "libsystem_kernel.dylib"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 6678065152,
    "size" : 286720,
    "uuid" : "c05e486d-81f2-367e-9ce1-e14573c4c268",
    "path" : "\/usr\/lib\/system\/libdispatch.dylib",
    "name" : "libdispatch.dylib"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 8876146688,
    "size" : 294912,
    "uuid" : "527f7127-9586-32c8-9d8b-2972d39ead7a",
    "path" : "\/usr\/lib\/system\/libxpc.dylib",
    "name" : "libxpc.dylib"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 7233900544,
    "size" : 229376,
    "uuid" : "0069695f-07da-394a-83ac-c0475b592c39",
    "path" : "\/usr\/lib\/libAudioToolboxUtility.dylib",
    "name" : "libAudioToolboxUtility.dylib"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 6767804416,
    "size" : 3829760,
    "uuid" : "32bc06da-508f-39f2-bda5-a9d1e566048f",
    "path" : "\/System\/Library\/PrivateFrameworks\/AudioToolboxCore.framework\/AudioToolboxCore",
    "name" : "AudioToolboxCore"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 8875839488,
    "size" : 53236,
    "uuid" : "6f6e4925-1fb4-3a0b-99d2-6bd8b7b1a148",
    "path" : "\/usr\/lib\/system\/libsystem_pthread.dylib",
    "name" : "libsystem_pthread.dylib"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 6678351872,
    "size" : 524284,
    "uuid" : "400d888f-8548-33fc-802f-f29678681197",
    "path" : "\/usr\/lib\/system\/libsystem_c.dylib",
    "name" : "libsystem_c.dylib"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 6525259776,
    "size" : 13832192,
    "uuid" : "e2f95328-659e-3c01-97f7-52b5b3bb7aa5",
    "path" : "\/System\/Library\/Frameworks\/Foundation.framework\/Foundation",
    "name" : "Foundation"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 6821134336,
    "size" : 245752,
    "uuid" : "fb709ae1-a2c5-3c81-a7d0-5f66cdedda9a",
    "path" : "\/usr\/lib\/system\/libsystem_malloc.dylib",
    "name" : "libsystem_malloc.dylib"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 6501613568,
    "size" : 330960,
    "uuid" : "a6a17b3c-3351-30ad-af28-15a71b78f050",
    "path" : "\/usr\/lib\/libobjc.A.dylib",
    "name" : "libobjc.A.dylib"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 6823698432,
    "size" : 581628,
    "uuid" : "09bdee26-e6c3-3545-8cc9-6f215deafb43",
    "path" : "\/usr\/lib\/libc++.1.dylib",
    "name" : "libc++.1.dylib"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 6568189952,
    "size" : 3952640,
    "uuid" : "e610c6a8-da36-3e07-910f-2d4a62320985",
    "path" : "\/System\/Library\/Frameworks\/CFNetwork.framework\/CFNetwork",
    "name" : "CFNetwork"
  }
],
  "sharedCache" : {
  "base" : 6500532224,
  "size" : 4385095680,
  "uuid" : "f83ea264-83f5-3901-b74d-9c78c358cd47"
},
  "vmSummary" : "ReadOnly portion of Libraries: Total=1.4G resident=0K(0%) swapped_out_or_unallocated=1.4G(100%)\nWritable regions: Total=604.3M written=369K(0%) resident=369K(0%) swapped_out=0K(0%) unallocated=603.9M(100%)\n\n                                VIRTUAL   REGION \nREGION TYPE                        SIZE    COUNT (non-coalesced) \n===========                     =======  ======= \nActivity Tracing                   256K        1 \nAudio                               64K        1 \nCG raster data                    1152K       21 \nColorSync                          160K        5 \nCoreAnimation                     3424K      110 \nFoundation                          16K        1 \nImage IO                          13.3M       46 \nKernel Alloc Once                   32K        1 \nMALLOC                           544.8M       16 \nMALLOC guard page                   32K        2 \nSQLite page cache                  640K        5 \nSTACK GUARD                        240K       15 \nStack                             8624K       15 \nVM_ALLOCATE                       17.3M       17 \n__AUTH                            4371K      495 \n__AUTH_CONST                      80.5M     1032 \n__CTF                               824        1 \n__DATA                            27.2M      984 \n__DATA_CONST                      26.4M     1041 \n__DATA_DIRTY                      8080K      941 \n__FONT_DATA                        2352        1 \n__INFO_FILTER                         8        1 \n__LINKEDIT                       212.2M        6 \n__LLVM_COV                          10K        1 \n__OBJC_RW                         2965K        1 \n__TEXT                             1.2G     1057 \n__TPRO_CONST                       272K        2 \nlibnetwork                        1664K       24 \nmapped file                       49.9M       41 \nowned unmapped memory             14.2M        1 \npage table in kernel               369K        1 \nshared memory                       80K        4 \n===========                     =======  ======= \nTOTAL                              2.2G     5890 \n",
  "legacyInfo" : {
  "threadTriggered" : {
    "name" : "com.facebook.react.runtime.JavaScript"
  }
},
  "logWritingSignature" : "1369082ece99cf75b15d7e2ccf71591b8b6a9792",
  "trialInfo" : {
  "rollouts" : [
    {
      "rolloutId" : "60da5e84ab0ca017dace9abf",
      "factorPackIds" : {

      },
      "deploymentId" : 240000008
    },
    {
      "rolloutId" : "5ffde50ce2aacd000d47a95f",
      "factorPackIds" : {

      },
      "deploymentId" : 240000506
    }
  ],
  "experiments" : [
    {
      "treatmentId" : "582596be-1d4a-408d-901b-5b311c006a4a",
      "experimentId" : "65f31ccb74b6f500a45abda4",
      "deploymentId" : 400000026
    },
    {
      "treatmentId" : "81ecc680-43c7-4a94-bc0e-7c6ae3a5ddc2",
      "experimentId" : "6685b5584477001000e8c6c9",
      "deploymentId" : 400000009
    }
  ]
}
}
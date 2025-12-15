# C++ Exception: N8facebook3jsi7JSErrorE: ExceptionsManager.reportException raised an exception: Unhandled JS Exception: Error: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined.

**Issue ID:** 7112071862
**Project:** react-native
**Date:** 12/14/2025, 11:12:45 PM
## Issue Summary
React Crash: Undefined Element Type During Reconciliation
**What's wrong:** React rendering failed: **Element type is invalid**; expected string or class/function but got **undefined**.
**In the trace:** Multiple successful **HEAD requests** to Supabase API endpoints preceded the crash.
**Possible cause:** A component expected to be rendered is **undefined**, possibly due to a failed data fetch or incorrect component import/export.

## Tags

- **app.device:** db1431484a732c85150ad0312210e3cb1c436828
- **appVersion:** 1.0.0
- **device:** iPhone14,7
- **device.class:** high
- **device.family:** iOS
- **deviceId:** DCA3CA77-7562-496C-B957-E26F4B07DCC2
- **dist:** 10
- **environment:** production
- **event.environment:** native
- **event.origin:** ios
- **executionEnvironment:** bare
- **expoChannel:** null
- **expoGoVersion:** null
- **expoRuntimeVersion:** null
- **handled:** no
- **level:** fatal
- **mechanism:** cpp_exception
- **os:** iOS 18.3.2
- **os.build:** 22D82
- **os.name:** iOS
- **os.rooted:** no
- **release:** com.execudex.app@1.0.0+10
- **user:** id:B4C41E85-983F-4101-88FB-14FE35BA0752

## Exception

### Exception 1
**Type:** C++ Exception
**Value:** N8facebook3jsi7JSErrorE: ExceptionsManager.reportException raised an exception: Unhandled JS Exception: Error: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined.

This er..., stack:
createFiberFromTypeAndProps@1:291532
reconcileChildFibersImpl@1:253954
anonymous@1:254122
reconcileChildren@1:258104
updateOffscreenComponent@1:259280
beginWork@1:266326
performUnitOfWork@1:286266
workLoopSync@1:285274
renderRootSync@1:285106
performWorkOnRoot@1:282750
performSyncWorkOnRoot@1:236525
flushSyncWorkAcrossRoots_impl@1:235416
processRootScheduleInMicrotask@1:235776
anonymous@1:236620


Error: ExceptionsManager.reportException raised an exception: Unhandled JS Exception: Error: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined.

This er..., stack:
createFiberFromTypeAndProps@1:291532
reconcileChildFibersImpl@1:253954
anonymous@1:254122
reconcileChildren

# C++ Exception: N8facebook3jsi7JSErrorE: ExceptionsManager.reportException raised an exception: Unhandled JS Exception: Error: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined.

**Issue ID:** 7112071862
**Project:** react-native
**Date:** 12/14/2025, 11:12:45 PM
## Issue Summary
React Crash: Undefined Element Type During Reconciliation
**What's wrong:** React rendering failed: **Element type is invalid**; expected string or class/function but got **undefined**.
**In the trace:** Multiple successful **HEAD requests** to Supabase API endpoints preceded the crash.
**Possible cause:** A component expected to be rendered is **undefined**, possibly due to a failed data fetch or incorrect component import/export.

## Tags

- **app.device:** db1431484a732c85150ad0312210e3cb1c436828
- **appVersion:** 1.0.0
- **device:** iPhone14,7
- **device.class:** high
- **device.family:** iOS
- **deviceId:** DCA3CA77-7562-496C-B957-E26F4B07DCC2
- **dist:** 10
- **environment:** production
- **event.environment:** native
- **event.origin:** ios
- **executionEnvironment:** bare
- **expoChannel:** null
- **expoGoVersion:** null
- **expoRuntimeVersion:** null
- **handled:** no
- **level:** fatal
- **mechanism:** cpp_exception
- **os:** iOS 18.3.2
- **os.build:** 22D82
- **os.name:** iOS
- **os.rooted:** no
- **release:** com.execudex.app@1.0.0+10
- **user:** id:B4C41E85-983F-4101-88FB-14FE35BA0752

## Exception

### Exception 1
**Type:** C++ Exception
**Value:** N8facebook3jsi7JSErrorE: ExceptionsManager.reportException raised an exception: Unhandled JS Exception: Error: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined.

This er..., stack:
createFiberFromTypeAndProps@1:291532
reconcileChildFibersImpl@1:253954
anonymous@1:254122
reconcileChildren@1:258104
updateOffscreenComponent@1:259280
beginWork@1:266326
performUnitOfWork@1:286266
workLoopSync@1:285274
renderRootSync@1:285106
performWorkOnRoot@1:282750
performSyncWorkOnRoot@1:236525
flushSyncWorkAcrossRoots_impl@1:235416
processRootScheduleInMicrotask@1:235776
anonymous@1:236620


Error: ExceptionsManager.reportException raised an exception: Unhandled JS Exception: Error: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined.

This er..., stack:
createFiberFromTypeAndProps@1:291532
reconcileChildFibersImpl@1:253954
anonymous@1:254122
reconcileChildren

# EXC_BAD_ACCESS: Exception 1, Code 1, Subcode 2169098 >

**Issue ID:** 7112073465
**Project:** react-native
**Date:** 12/14/2025, 11:13:11 PM
## Issue Summary
Hermes Crash: Bad Access During Function Call
**What's wrong:** Fatal **EXC_BAD_ACCESS** crash within **Hermes VM** during function call.
**In the trace:** Crash occurred during **React Native** event loop processing after successful **Supabase** data fetches.
**Possible cause:** The crash likely stems from accessing an invalid memory address (**KERN_INVALID_ADDRESS**) while manipulating a **Hermes BoundFunction**.

## Tags

- **app.device:** db1431484a732c85150ad0312210e3cb1c436828
- **appVersion:** 1.0.0
- **device:** iPhone14,7
- **device.class:** high
- **device.family:** iOS
- **deviceId:** D00EBA68-173A-4411-9B3B-1019D0A77F62
- **dist:** 10
- **environment:** production
- **event.environment:** native
- **event.origin:** ios
- **executionEnvironment:** bare
- **expoChannel:** null
- **expoGoVersion:** null
- **expoRuntimeVersion:** null
- **handled:** no
- **level:** fatal
- **mechanism:** mach
- **os:** iOS 18.3.2
- **os.build:** 22D82
- **os.name:** iOS
- **os.rooted:** no
- **release:** com.execudex.app@1.0.0+10
- **user:** id:B4C41E85-983F-4101-88FB-14FE35BA0752

## Exception

### Exception 1
**Type:** EXC_BAD_ACCESS
**Value:** Exception 1, Code 1, Subcode 2169098 >
KERN_INVALID_ADDRESS at 0x21190a.

#### Stacktrace

```
 hermes::vm::JSObject::addOwnPropertyImpl in unknown file [Line null] (In app)
 hermes::vm::BoundFunction::initializeLengthAndName_RJS in unknown file [Line null] (In app)
 hermes::vm::BoundFunction::create in unknown file [Line null] (In app)
 hermes::vm::functionPrototypeBind in unknown file [Line null] (In app)
 hermes::vm::NativeFunction::_nativeCall in unknown file [Line null] (In app)
 hermes::vm::Interpreter::handleCallSlowPath in unknown file [Line null] (In app)
 hermes::vm::Interpreter::interpretFunction<T> in unknown file [Line null] (In app)
 hermes::vm::Runtime::interpretFunctionImpl in unknown file [Line null] (In app)
 hermes::vm::JSFunction::_callImpl in unknown file [Line null] (In app)
 hermes::vm::Callable::executeCall0 in unknown file [Line null] (In app)
 hermes::vm::Runtime::drainJobs in unknown file [Line null] (In app)
 facebook::hermes::(anonymous namespace)::HermesRuntimeImpl::drainMicrotasks in unknown file [Line null] (In app)
 facebook::react::RuntimeScheduler_Modern::performMicrotaskCheckpoint in unknown file [Line null] (In app)
 facebook::react::RuntimeScheduler_Modern::runEventLoopTick in unknown file [Line null] (In app)
 facebook::react::RuntimeScheduler_Modern::runEventLoop in unknown file [Line null] (In app)
 std::__1::__function::__func<T>::operator() in unknown file [Line null] (Not in app)
```

# EXC_BAD_ACCESS: Exception 1, Code 2, Subcode 4371325344 >

**Issue ID:** 7114645877
**Project:** react-native
**Date:** 12/15/2025, 10:46:27 PM

## Root Cause
```
# Root Cause of the Issue

Component reference became undefined due to a race condition, causing the Hermes VM to crash during internal function binding.

### User navigates to the Politician Profile page (index1).
The navigation event triggers the mounting and execution of the `app/index1.tsx` module.
(See @app/index1.tsx)

### Sub-components are imported at the module level.
The components `Synop`, `Sub1`, `Sub2`, and `Sub3` are imported, making them available for immediate validation.
(See @app/index1.tsx)

### Components pass validation, providing false assurance of stability.
The `validateComponent` function runs immediately after import. At this moment, the component references are valid functions/objects, so they are stored as `ValidatedSynop`, etc., and added to the `TABS` array.

```typescript
ValidatedSynop = validateComponent(Synop, 'Synop');
// ...
const TABS = [
  { label: 'Synopsis',  key: 'synop',   component: ValidatedSynop,  componentName: 'Synop'  },
  // ...
];
```
(See @app/index1.tsx)

### Concurrent React Native activity causes component reference to become undefined.
Likely due to a race condition, module unloading, or memory corruption specific to the Hermes VM, the reference to one of the imported components (e.g., `ValidatedSynop`) is lost, becoming `undefined` at runtime.

### React attempts to render the component, finding it undefined.
The React rendering pipeline attempts to use the component from the `TABS` array, but finds it is `undefined`.

**Sentry Console Error:**
`Error: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined.`
(See @app/index1.tsx)

### Hermes VM attempts to bind a function to the undefined component, causing EXC_BAD_ACCESS.
The underlying JavaScript engine (Hermes) attempts to perform a function binding operation (`functionPrototypeBind`) on the corrupted or `undefined` component object, leading to a memory access violation (EXC_BAD_ACCESS) within the VM's internal object handling (`HiddenClass::initializeMissingPropertyMap`).

**Stack Trace Snippet:**
`hermes::vm::HiddenClass::initializeMissingPropertyMap`
`hermes::vm::HiddenClass::findProperty`
`hermes::vm::JSObject::defineOwnPropertyInternal`
`hermes::vm::BoundFunction::initializeLengthAndName_RJS`
`hermes::vm::BoundFunction::create`
`hermes::vm::functionPrototypeBind`
```

## Tags

- **app.device:** 2d0fa7e5c222bd3e32348f03deaff070b9e4fe17
- **appVersion:** 1.0.0
- **device:** iPhone14,7
- **device.class:** high
- **device.family:** iOS
- **deviceId:** D12C9A28-29DC-48E8-819A-E08D56D60C78
- **dist:** 16
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
- **release:** com.execudex.app@1.0.0+16
- **user:** id:A3D1FB76-A5E2-43B3-A68C-976D83964580

## Exception

### Exception 1
**Type:** EXC_BAD_ACCESS
**Value:** Exception 1, Code 2, Subcode 4371325344 >
KERN_PROTECTION_FAILURE at 0x1048d21a0.

#### Stacktrace

```
 hermes::vm::objectPrototypeHasOwnProperty in unknown file [Line null] (In app)
 hermes::vm::NativeFunction::_nativeCall in unknown file [Line null] (In app)
 hermes::vm::functionPrototypeCall in unknown file [Line null] (In app)
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
 facebook::react::tryAndReturnError in unknown file [Line null] (In app)
```


# EXC_BAD_ACCESS: Exception 1, Code 2, Subcode 4371325344 >

**Issue ID:** 7114645877
**Project:** react-native
**Date:** 12/15/2025, 10:46:27 PM

## Root Cause
```
# Root Cause of the Issue

Component reference became undefined due to a race condition, causing the Hermes VM to crash during internal function binding.

### User navigates to the Politician Profile page (index1).
The navigation event triggers the mounting and execution of the `app/index1.tsx` module.
(See @app/index1.tsx)

### Sub-components are imported at the module level.
The components `Synop`, `Sub1`, `Sub2`, and `Sub3` are imported, making them available for immediate validation.
(See @app/index1.tsx)

### Components pass validation, providing false assurance of stability.
The `validateComponent` function runs immediately after import. At this moment, the component references are valid functions/objects, so they are stored as `ValidatedSynop`, etc., and added to the `TABS` array.

```typescript
ValidatedSynop = validateComponent(Synop, 'Synop');
// ...
const TABS = [
  { label: 'Synopsis',  key: 'synop',   component: ValidatedSynop,  componentName: 'Synop'  },
  // ...
];
```
(See @app/index1.tsx)

### Concurrent React Native activity causes component reference to become undefined.
Likely due to a race condition, module unloading, or memory corruption specific to the Hermes VM, the reference to one of the imported components (e.g., `ValidatedSynop`) is lost, becoming `undefined` at runtime.

### React attempts to render the component, finding it undefined.
The React rendering pipeline attempts to use the component from the `TABS` array, but finds it is `undefined`.

**Sentry Console Error:**
`Error: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined.`
(See @app/index1.tsx)

### Hermes VM attempts to bind a function to the undefined component, causing EXC_BAD_ACCESS.
The underlying JavaScript engine (Hermes) attempts to perform a function binding operation (`functionPrototypeBind`) on the corrupted or `undefined` component object, leading to a memory access violation (EXC_BAD_ACCESS) within the VM's internal object handling (`HiddenClass::initializeMissingPropertyMap`).

**Stack Trace Snippet:**
`hermes::vm::HiddenClass::initializeMissingPropertyMap`
`hermes::vm::HiddenClass::findProperty`
`hermes::vm::JSObject::defineOwnPropertyInternal`
`hermes::vm::BoundFunction::initializeLengthAndName_RJS`
`hermes::vm::BoundFunction::create`
`hermes::vm::functionPrototypeBind`
```

## Tags

- **app.device:** 2d0fa7e5c222bd3e32348f03deaff070b9e4fe17
- **appVersion:** 1.0.0
- **device:** iPhone14,7
- **device.class:** high
- **device.family:** iOS
- **deviceId:** D12C9A28-29DC-48E8-819A-E08D56D60C78
- **dist:** 16
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
- **release:** com.execudex.app@1.0.0+16
- **user:** id:A3D1FB76-A5E2-43B3-A68C-976D83964580

## Exception

### Exception 1
**Type:** EXC_BAD_ACCESS
**Value:** Exception 1, Code 2, Subcode 4371325344 >
KERN_PROTECTION_FAILURE at 0x1048d21a0.

#### Stacktrace

```
 hermes::vm::objectPrototypeHasOwnProperty in unknown file [Line null] (In app)
 hermes::vm::NativeFunction::_nativeCall in unknown file [Line null] (In app)
 hermes::vm::functionPrototypeCall in unknown file [Line null] (In app)
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
 facebook::react::tryAndReturnError in unknown file [Line null] (In app)
```

# C++ Exception: N8facebook3jsi7JSErrorE: ExceptionsManager.reportException raised an exception: Unhandled JS Exception: ReferenceError: Property 'cleanup' doesn't exist

**Issue ID:** 7190467727
**Project:** react-native
**Date:** 1/14/2026, 6:00:18 PM
## Issue Summary
JS ReferenceError: Missing 'cleanup' in Onboarding
**What's wrong:** Unhandled **JavaScript ReferenceError**: property 'cleanup' does not exist. Error occurs during **Onboarding** component lifecycle.
**In the trace:** Session was missing, causing the app to remain on the **onboarding** route.
**Possible cause:** The **Onboarding** component or a related hook attempts to call a function named 'cleanup' which is **undefined** or **not exported**.

## Tags

- **app.device:** d4c8662b68b66d6675388411e96b5c5b59a04581
- **appVersion:** 1.0.0
- **device:** iPhone14,7
- **device.class:** high
- **device.family:** iOS
- **deviceId:** AAA9FDA6-3A9E-4600-87BF-B22A4C9833E3
- **dist:** 37
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
- **release:** com.execudex.app@1.0.0+37
- **user:** id:30F09FA7-6444-4C3F-9AEC-247041CF85A9

## Exception

### Exception 1
**Type:** C++ Exception
**Value:** N8facebook3jsi7JSErrorE: ExceptionsManager.reportException raised an exception: Unhandled JS Exception: ReferenceError: Property 'cleanup' doesn't exist

This error is located at:
    at Onboarding (address at /private/var/containers/Bundle/Application/33..., stack:
anonymous@1:2261006
commitHookEffectListMount@1:277926
recursivelyTraverseReconnectPassiveEffects@1:284965
recursivelyTraverseReconnectPassiveEffects@1:284783
recursivelyTraverseReconnectPassiveEffects@1:284650
recursivelyTraverseReconnectPassiveEffects@1:284650
recursivelyTraverseReconnectPassiveEffects@1:284650
recursivelyTraverseReconnectPassiveEffects@1:284956
recursivelyTraverseReconnectPassiveEffects@1:284956
recursivelyTraverseReconnectPassiveEffects@1:284956
recursivelyTraverseReconnectPassiveEffects@1:284650
recursivelyTraverseReconnectPassiveEffects@1:284650
recursivelyTraverseReconnectPassiveEffects@1:284956
recursivelyTraverseReconnectPassiveEffects@1:284650
recursivelyTraverseReconnectPassiveEffects@1:284650
recursivelyTraverseReconne


## Thread:  Thread 0

#### Stacktrace

```
 ApplyVariationsToGlyph in unknown file [Line null] (Not in app)
 ApplyFeaturesToOutline in unknown file [Line null] (Not in app)
 StretchGlyph in unknown file [Line null] (Not in app)
 CreateGlyphOutline in unknown file [Line null] (Not in app)
 CreateGlyphElement in unknown file [Line null] (Not in app)
 CreateScalerGlyphBlock in unknown file [Line null] (Not in app)
 AssureGlyphBlock in unknown file [Line null] (Not in app)
 TTRenderGlyphs in unknown file [Line null] (Not in app)
 TConcreteFontScaler::CopyGlyphPath in unknown file [Line null] (Not in app)
 TFPFont::CopyGlyphPath in unknown file [Line null] (Not in app)
 TFPFont::CopyGlyphPath in unknown file [Line null] (Not in app)
 FPFontCopyGlyphPath in unknown file [Line null] (Not in app)
 CGFontCreateGlyphPath in unknown file [Line null] (Not in app)
 CGGlyphBuilderLockBitmaps in unknown file [Line null] (Not in app)
 render_glyphs in unknown file [Line null] (Not in app)
 draw_glyph_bitmaps in unknown file [Line null] (Not in app)
```


breadcrumbs by sentry below 

| Timestamp | Type | Category | Level | Message | Data |
|-----------|------|----------|-------|---------|------|
| 2026-01-14T23:00:18.685Z | debug | started | info | Breadcrumb Tracking |  |
| 2026-01-14T23:00:18.690Z | debug | console | debug | [GLOBAL_ERROR_HANDLER] Initialized | {"arguments":["[GLOBAL_ERROR_HANDLER] Initialized"],"logger":"console"} |
| 2026-01-14T23:00:18.690Z | default | router | info | Mounted /profile/_layout |  |
| 2026-01-14T23:00:18.690Z | debug | console | debug | [INFO] [logger] [object Object] | {"arguments":["[INFO] [logger]",{"action":"initialized","entryCount":0}],"logger":"console"} |
| 2026-01-14T23:00:18.691Z | debug | console | warning | Method getInfoAsync imported from "expo-file-system" is deprecated. You can migrate to the new filesystem API using "File" and "Directory" classes or import the legacy API from "expo-file-system/legacy". API reference and examples are available in the filesystem docs: https://docs.expo.dev/versions/v54.0.0/sdk/filesystem/ | {"arguments":["Method getInfoAsync imported from \\"expo-file-system\\" is deprecated.\\nYou can migrate to the new filesystem API using \\"File\\" and \\"Directory\\" classes or import the legacy API from \\"expo-file-system/legacy\\".\\nAPI reference and examples are available in the filesystem docs: https://docs.expo.dev/versions/v54.0.0/sdk/filesystem/"],"logger":"console"} |
| 2026-01-14T23:00:18.691Z | debug | console | debug | [INFO] [app] [object Object] | {"arguments":["[INFO] [app]",{"action":"startup","timestamp":1768430000000}],"logger":"console"} |
| 2026-01-14T23:00:18.691Z | debug | console | warning | Method getInfoAsync imported from "expo-file-system" is deprecated. You can migrate to the new filesystem API using "File" and "Directory" classes or import the legacy API from "expo-file-system/legacy". API reference and examples are available in the filesystem docs: https://docs.expo.dev/versions/v54.0.0/sdk/filesystem/ | {"arguments":["Method getInfoAsync imported from \\"expo-file-system\\" is deprecated.\\nYou can migrate to the new filesystem API using \\"File\\" and \\"Directory\\" classes or import the legacy API from \\"expo-file-system/legacy\\".\\nAPI reference and examples are available in the filesystem docs: https://docs.expo.dev/versions/v54.0.0/sdk/filesystem/"],"logger":"console"} |
| 2026-01-14T23:00:18.717Z | connectivity | device.connectivity | info |  | {"connectivity":"wifi"} |
| 2026-01-14T23:00:18.920Z | debug | console | debug | [Filtered] | {"arguments":["[Filtered]"],"logger":"console"} |
| 2026-01-14T23:00:18.923Z | debug | console | debug | [Filtered] | {"arguments":["[Filtered]"],"logger":"console"} |
| 2026-01-14T23:00:18.924Z | debug | console | debug | [Filtered] | {"arguments":["[Filtered]"],"logger":"console"} |
| 2026-01-14T23:00:18.924Z | debug | console | debug | [Filtered] | {"arguments":["[Filtered]",{"hasSession":false}],"logger":"console"} |
| 2026-01-14T23:00:18.924Z | debug | console | debug | [Filtered] | {"arguments":["[Filtered]"],"logger":"console"} |
| 2026-01-14T23:00:18.924Z | debug | console | debug | [Filtered] | {"arguments":["[Filtered]",{"hasError":false,"hasSession":false}],"logger":"console"} |
| 2026-01-14T23:00:18.924Z | debug | console | debug | [Filtered] | {"arguments":["[Filtered]",{"hasSession":false}],"logger":"console"} |
| 2026-01-14T23:00:18.925Z | debug | console | debug | [InitialRouteHandler] No session - staying on onboarding | {"arguments":["[InitialRouteHandler] No session - staying on onboarding"],"logger":"console"} |
| 2026-01-14T23:00:18.925Z | debug | console | warning | Layout children must be of type Screen, all other children are ignored. To use custom children, create a custom <Layout />. Update Layout Route at: "app/_layout" | {"arguments":["Layout children must be of type Screen, all other children are ignored. To use custom children, create a custom <Layout />. Update Layout Route at: \\"app/_layout\\""],"logger":"console"} |
| 2026-01-14T23:00:18.000Z | error | exception | error |  | {"type":"C++ Exception","value":"N8facebook3jsi7JSErrorE: ExceptionsManager.reportException raised an exception: Unhandled JS Exception: ReferenceError: Property 'cleanup' doesn't exist\\n\\nThis error is located at:\\n    at Onboarding (address at /private/var/containers/Bundle/Application/33..., stack:\\nanonymous@1:2261006\\ncommitHookEffectListMount@1:277926\\nrecursivelyTraverseReconnectPassiveEffects@1:284965\\nrecursivelyTraverseReconnectPassiveEffects@1:284783\\nrecursivelyTraverseReconnectPassiveEffects@1:284650\\nrecursivelyTraverseReconnectPassiveEffects@1:284650\\nrecursivelyTraverseReconnectPassiveEffects@1:284650\\nrecursivelyTraverseReconnectPassiveEffects@1:284956\\nrecursivelyTraverseReconnectPassiveEffects@1:284956\\nrecursivelyTraverseReconnectPassiveEffects@1:284956\\nrecursivelyTraverseReconnectPassiveEffects@1:284650\\nrecursivelyTraverseReconnectPassiveEffects@1:284650\\nrecursivelyTraverseReconnectPassiveEffects@1:284956\\nrecursivelyTraverseReconnectPassiveEffects@1:284650\\nrecursivelyTraverseReconnectPassiveEffects@1:284650\\nrecursivelyTraverseReconne"} |
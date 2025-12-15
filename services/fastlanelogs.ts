Creating Gymfile

Gymfile created

Successfully loaded '/Users/expo/workingdir/build/ios/Gymfile' 📄

+---------------------------------------------------------------------------------------------------------------------------------------------------------------------+

|                                                                  Detected Values from './Gymfile'                                                                   |

+-----------------------+---------------------------------------------------------------------------------------------------------------------------------------------+

| suppress_xcode_output | true                                                                                                                                        |

| clean                 | false                                                                                                                                       |

| scheme                | Execudex                                                                                                                                    |

| configuration         | Release                                                                                                                                     |

| export_options        |                                                                                                                                             |

| export_xcargs         | OTHER_CODE_SIGN_FLAGS="--keychain /var/folders/5_/4knlryn57n39p2c_jw8567z00000gn/T/eas-build-5ea6960a-23bd-4e76-a5fa-a95f274aae7b.keychain" |

| disable_xcpretty      | true                                                                                                                                        |

| buildlog_path         | /Users/expo/workingdir/logs                                                                                                                 |

| output_directory      | ./build                                                                                                                                     |

+-----------------------+---------------------------------------------------------------------------------------------------------------------------------------------+

Resolving Swift Package Manager dependencies...

$ xcodebuild -resolvePackageDependencies -workspace ./Execudex.xcworkspace -scheme Execudex -configuration Release

▸ Command line invocation:

▸     /Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild -resolvePackageDependencies -workspace ./Execudex.xcworkspace -scheme Execudex -configuration Release

▸ resolved source packages:

$ xcodebuild -showBuildSettings -workspace ./Execudex.xcworkspace -scheme Execudex -configuration Release 2>&1

Detected provisioning profile mapping: {:"com.execudex.app"=>"1c2c81e2-629d-44bd-ad41-d80fb222d549"}

+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+

|                                                                                      Summary for gym 2.228.0                                                                                       |

+------------------------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------+

| workspace                                            | ./Execudex.xcworkspace                                                                                                                      |

| scheme                                               | Execudex                                                                                                                                    |

| clean                                                | false                                                                                                                                       |

| output_directory                                     | ./build                                                                                                                                     |

| output_name                                          | Execudex                                                                                                                                    |

| configuration                                        | Release                                                                                                                                     |

| silent                                               | false                                                                                                                                       |

| skip_package_ipa                                     | false                                                                                                                                       |

| skip_package_pkg                                     | false                                                                                                                                       |

| export_options.method                                | app-store                                                                                                                                   |

| export_options.provisioningProfiles.com.execudex.app | 1c2c81e2-629d-44bd-ad41-d80fb222d549                                                                                                        |

| export_xcargs                                        | OTHER_CODE_SIGN_FLAGS="--keychain /var/folders/5_/4knlryn57n39p2c_jw8567z00000gn/T/eas-build-5ea6960a-23bd-4e76-a5fa-a95f274aae7b.keychain" |

| build_path                                           | /Users/expo/Library/Developer/Xcode/Archives/2025-12-14                                                                                     |

| result_bundle                                        | false                                                                                                                                       |

| buildlog_path                                        | /Users/expo/workingdir/logs                                                                                                                 |

| destination                                          | generic/platform=iOS                                                                                                                        |

| suppress_xcode_output                                | true                                                                                                                                        |

| xcodebuild_formatter                                 | xcpretty                                                                                                                                    |

| build_timing_summary                                 | false                                                                                                                                       |

| disable_xcpretty                                     | true                                                                                                                                        |

| skip_profile_detection                               | false                                                                                                                                       |

| xcodebuild_command                                   | xcodebuild                                                                                                                                  |

| skip_package_dependencies_resolution                 | false                                                                                                                                       |

| disable_package_automatic_updates                    | false                                                                                                                                       |

| use_system_scm                                       | false                                                                                                                                       |

| xcode_path                                           | /Applications/Xcode.app                                                                                                                     |

+------------------------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------+

$ set -o pipefail && xcodebuild -workspace ./Execudex.xcworkspace -scheme Execudex -configuration Release -destination 'generic/platform=iOS' -archivePath /Users/expo/Library/Developer/Xcode/Archives/2025-12-14/Execudex\ 2025-12-14\ 18.27.34.xcarchive archive | tee /Users/expo/workingdir/logs/Execudex-Execudex.log > /dev/null

› Executing react-native Pods/hermes-engine » [CP-User] [Hermes] Replace Hermes for the right configuration, if needed

› Executing [CP-User] [RNDeps] Replace React Native Dependencies for the right configuration, if needed

› Preparing Pods/expo-dev-menu-EXDevMenu » ResourceBundle-EXDevMenu-expo-dev-menu-Info.plist

› Preparing Pods/Sentry-Sentry » ResourceBundle-Sentry-Sentry-Info.plist

› Copying   ../../../Users/expo/Library/Developer/Xcode/DerivedData/Execudex-cjoyvujbewkrleeypphkmapplywt/Build/Intermediates.noindex/ArchiveIntermediates/Execudex/IntermediateBuildFilesPath/UninstalledProducts/iphoneos/Sentry.bundle/PrivacyInfo.xcprivacy ➜ ../../../Users/expo/workingdir/build/ios/Pods/Sentry/Sources/Resources/PrivacyInfo.xcprivacy

› Creating  Pods/expo-dev-menu-EXDevMenu » EXDevMenu.bundle

› Creating  Pods/Sentry-Sentry » Sentry.bundle

› Preparing expo-image Pods/SDWebImage-SDWebImage » ResourceBundle-SDWebImage-SDWebImage-Info.plist

› Copying   expo-image ../../../Users/expo/Library/Developer/Xcode/DerivedData/Execudex-cjoyvujbewkrleeypphkmapplywt/Build/Intermediates.noindex/ArchiveIntermediates/Execudex/IntermediateBuildFilesPath/UninstalledProducts/iphoneos/SDWebImage.bundle/PrivacyInfo.xcprivacy ➜ ../../../Users/expo/workingdir/build/ios/Pods/SDWebImage/WebImage/PrivacyInfo.xcprivacy

› Executing react-native Pods/hermes-engine » [CP] Copy XCFrameworks

› Creating  expo-image Pods/SDWebImage-SDWebImage » SDWebImage.bundle

› Preparing Pods/React-cxxreact-React-cxxreact_privacy » ResourceBundle-React-cxxreact_privacy-React-cxxreact-Info.plist

› Copying   ../../../Users/expo/Library/Developer/Xcode/DerivedData/Execudex-cjoyvujbewkrleeypphkmapplywt/Build/Intermediates.noindex/ArchiveIntermediates/Execudex/IntermediateBuildFilesPath/UninstalledProducts/iphoneos/React-cxxreact_privacy.bundle/PrivacyInfo.xcprivacy ➜ ../../../Users/expo/workingdir/build/node_modules/react-native/ReactCommon/cxxreact/PrivacyInfo.xcprivacy

› Preparing Pods/React-Core-React-Core_privacy » ResourceBundle-React-Core_privacy-React-Core-Info.plist

› Copying   ../../../Users/expo/Library/Developer/Xcode/DerivedData/Execudex-cjoyvujbewkrleeypphkmapplywt/Build/Intermediates.noindex/ArchiveIntermediates/Execudex/IntermediateBuildFilesPath/UninstalledProducts/iphoneos/React-Core_privacy.bundle/PrivacyInfo.xcprivacy ➜ ../../../Users/expo/workingdir/build/node_modules/react-native/React/Resources/PrivacyInfo.xcprivacy

› Creating  Pods/React-cxxreact-React-cxxreact_privacy » React-cxxreact_privacy.bundle

› Preparing expo-updates Pods/ReachabilitySwift-ReachabilitySwift » ResourceBundle-ReachabilitySwift-ReachabilitySwift-Info.plist

› Copying   expo-updates ../../../Users/expo/Library/Developer/Xcode/DerivedData/Execudex-cjoyvujbewkrleeypphkmapplywt/Build/Intermediates.noindex/ArchiveIntermediates/Execudex/IntermediateBuildFilesPath/UninstalledProducts/iphoneos/ReachabilitySwift.bundle/PrivacyInfo.xcprivacy ➜ ../../../Users/expo/workingdir/build/ios/Pods/ReachabilitySwift/Sources/PrivacyInfo.xcprivacy

› Creating  Pods/React-Core-React-Core_privacy » React-Core_privacy.bundle

› Creating  expo-updates Pods/ReachabilitySwift-ReachabilitySwift » ReachabilitySwift.bundle

› Preparing Pods/RNCAsyncStorage-RNCAsyncStorage_resources » ResourceBundle-RNCAsyncStorage_resources-RNCAsyncStorage-Info.plist

› Copying   ../../../Users/expo/Library/Developer/Xcode/DerivedData/Execudex-cjoyvujbewkrleeypphkmapplywt/Build/Intermediates.noindex/ArchiveIntermediates/Execudex/IntermediateBuildFilesPath/UninstalledProducts/iphoneos/RNCAsyncStorage_resources.bundle/PrivacyInfo.xcprivacy ➜ ../../../Users/expo/workingdir/build/node_modules/@react-native-async-storage/async-storage/ios/PrivacyInfo.xcprivacy

› Preparing Pods/ExpoSystemUI-ExpoSystemUI_privacy » ResourceBundle-ExpoSystemUI_privacy-ExpoSystemUI-Info.plist

› Copying   ../../../Users/expo/Library/Developer/Xcode/DerivedData/Execudex-cjoyvujbewkrleeypphkmapplywt/Build/Intermediates.noindex/ArchiveIntermediates/Execudex/IntermediateBuildFilesPath/UninstalledProducts/iphoneos/ExpoSystemUI_privacy.bundle/PrivacyInfo.xcprivacy ➜ ../../../Users/expo/workingdir/build/node_modules/expo-system-ui/ios/PrivacyInfo.xcprivacy

› Creating  Pods/RNCAsyncStorage-RNCAsyncStorage_resources » RNCAsyncStorage_resources.bundle

› Preparing Pods/ExpoFileSystem-ExpoFileSystem_privacy » ResourceBundle-ExpoFileSystem_privacy-ExpoFileSystem-Info.plist

› Copying   ../../../Users/expo/Library/Developer/Xcode/DerivedData/Execudex-cjoyvujbewkrleeypphkmapplywt/Build/Intermediates.noindex/ArchiveIntermediates/Execudex/IntermediateBuildFilesPath/UninstalledProducts/iphoneos/ExpoFileSystem_privacy.bundle/PrivacyInfo.xcprivacy ➜ ../../../Users/expo/workingdir/build/node_modules/expo-file-system/ios/PrivacyInfo.xcprivacy

› Creating  Pods/ExpoSystemUI-ExpoSystemUI_privacy » ExpoSystemUI_privacy.bundle

› Preparing Pods/ExpoDevice-ExpoDevice_privacy » ResourceBundle-ExpoDevice_privacy-ExpoDevice-Info.plist

› Copying   ../../../Users/expo/Library/Developer/Xcode/DerivedData/Execudex-cjoyvujbewkrleeypphkmapplywt/Build/Intermediates.noindex/ArchiveIntermediates/Execudex/IntermediateBuildFilesPath/UninstalledProducts/iphoneos/ExpoDevice_privacy.bundle/PrivacyInfo.xcprivacy ➜ ../../../Users/expo/workingdir/build/node_modules/expo-device/ios/PrivacyInfo.xcprivacy

› Creating  Pods/ExpoFileSystem-ExpoFileSystem_privacy » ExpoFileSystem_privacy.bundle

› Preparing expo-updates Pods/EXUpdates-EXUpdates » ResourceBundle-EXUpdates-EXUpdates-Info.plist

› Creating  Pods/ExpoDevice-ExpoDevice_privacy » ExpoDevice_privacy.bundle

› Creating  expo-updates Pods/EXUpdates-EXUpdates » EXUpdates.bundle

› Preparing Pods/EXConstants-ExpoConstants_privacy » ResourceBundle-ExpoConstants_privacy-EXConstants-Info.plist

› Copying   ../../../Users/expo/Library/Developer/Xcode/DerivedData/Execudex-cjoyvujbewkrleeypphkmapplywt/Build/Intermediates.noindex/ArchiveIntermediates/Execudex/IntermediateBuildFilesPath/UninstalledProducts/iphoneos/ExpoConstants_privacy.bundle/PrivacyInfo.xcprivacy ➜ ../../../Users/expo/workingdir/build/node_modules/expo-constants/ios/PrivacyInfo.xcprivacy

› Executing react-native Pods/ReactNativeDependencies » [CP] Copy XCFrameworks

› Creating  Pods/EXConstants-ExpoConstants_privacy » ExpoConstants_privacy.bundle

› Preparing Pods/EXApplication-ExpoApplication_privacy » ResourceBundle-ExpoApplication_privacy-EXApplication-Info.plist

› Copying   ../../../Users/expo/Library/Developer/Xcode/DerivedData/Execudex-cjoyvujbewkrleeypphkmapplywt/Build/Intermediates.noindex/ArchiveIntermediates/Execudex/IntermediateBuildFilesPath/UninstalledProducts/iphoneos/ExpoApplication_privacy.bundle/PrivacyInfo.xcprivacy ➜ ../../../Users/expo/workingdir/build/node_modules/expo-application/ios/PrivacyInfo.xcprivacy

› Creating  expo-constants Pods/EXConstants-EXConstants » EXConstants.bundle

› Creating  Pods/EXApplication-ExpoApplication_privacy » ExpoApplication_privacy.bundle

› Compiling expo-image Pods/libwebp » yuv_sse41.c

› Compiling expo-image Pods/libwebp » yuv_sse2.c

› Compiling expo-image Pods/libwebp » yuv_mips_dsp_r2.c

› Compiling expo-image Pods/libwebp » yuv_mips32.c

› Compiling expo-image Pods/libwebp » upsampling_sse41.c

› Compiling expo-image Pods/libwebp » upsampling_sse2.c

› Compiling expo-image Pods/libwebp » upsampling_msa.c

› Compiling expo-image Pods/libwebp » upsampling_mips_dsp_r2.c

› Compiling expo-image Pods/libwebp » upsampling.c

› Compiling expo-image Pods/libwebp » yuv_neon.c

› Compiling expo-image Pods/libwebp » yuv.c

› Compiling expo-image Pods/libwebp » webp_enc.c

› Compiling expo-image Pods/libwebp » webp_dec.c

› Compiling expo-image Pods/libwebp » vp8l_enc.c

› Compiling expo-image Pods/libwebp » vp8l_dec.c

› Compiling expo-image Pods/libwebp » vp8_dec.c

› Compiling expo-image Pods/libwebp » tree_enc.c

› Compiling expo-image Pods/libwebp » tree_dec.c

› Compiling expo-image Pods/libwebp » token_enc.c

› Compiling expo-image Pods/libwebp » thread_utils.c

› Compiling expo-image Pods/libwebp » syntax_enc.c

› Compiling expo-image Pods/libwebp » ssim_sse2.c

› Compiling expo-image Pods/libwebp » ssim.c

› Compiling expo-image Pods/libwebp » sharpyuv_sse2.c

› Compiling expo-image Pods/libwebp » sharpyuv_neon.c

› Compiling expo-image Pods/libwebp » sharpyuv_dsp.c

› Compiling expo-image Pods/libwebp » sharpyuv_gamma.c

› Compiling expo-image Pods/libwebp » sharpyuv_csp.c

› Compiling expo-image Pods/libwebp » sharpyuv_cpu.c

› Compiling expo-image Pods/libwebp » rescaler_sse2.c

› Compiling expo-image Pods/libwebp » rescaler_neon.c

› Compiling expo-image Pods/libwebp » rescaler_msa.c

› Compiling expo-image Pods/libwebp » sharpyuv.c

› Compiling expo-image Pods/libwebp » rescaler_utils.c

› Compiling expo-image Pods/libwebp » rescaler_mips_dsp_r2.c

› Compiling expo-image Pods/libwebp » rescaler_mips32.c

› Compiling expo-image Pods/libwebp » rescaler.c

› Compiling expo-image Pods/libwebp » random_utils.c

› Compiling expo-image Pods/libwebp » quant_levels_utils.c

› Compiling expo-image Pods/libwebp » quant_levels_dec_utils.c

› Compiling expo-image Pods/libwebp » quant_enc.c

› Compiling expo-image Pods/libwebp » quant_dec.c

› Compiling expo-image Pods/libwebp » predictor_enc.c

› Compiling expo-image Pods/libwebp » picture_rescale_enc.c

› Compiling expo-image Pods/libwebp » picture_psnr_enc.c

› Compiling expo-image Pods/libwebp » picture_enc.c

› Compiling expo-image Pods/libwebp » picture_csp_enc.c

› Compiling expo-image Pods/libwebp » palette.c

› Compiling expo-image Pods/libwebp » near_lossless_enc.c

› Compiling muxread.c

› Compiling expo-image Pods/libwebp » muxinternal.c

› Compiling expo-image Pods/libwebp » muxedit.c

› Compiling expo-image Pods/libwebp » lossless_sse41.c

› Compiling expo-image Pods/libwebp » lossless_sse2.c

› Compiling expo-image Pods/libwebp » lossless_neon.c

› Compiling expo-image Pods/libwebp » lossless_msa.c

› Compiling expo-image Pods/libwebp » lossless_mips_dsp_r2.c

› Compiling expo-image Pods/libwebp » lossless_enc_sse41.c

› Compiling expo-image Pods/libwebp » lossless_enc_sse2.c

› Compiling expo-image Pods/libwebp » lossless_enc_neon.c

› Compiling expo-image Pods/libwebp » lossless_enc_msa.c

› Compiling expo-image Pods/libwebp » lossless_enc_mips_dsp_r2.c

› Compiling expo-image Pods/libwebp » lossless_enc.c

› Compiling expo-image Pods/libwebp » lossless.c

› Compiling expo-image Pods/libwebp » iterator_enc.c

› Compiling expo-image Pods/libwebp » io_dec.c

› Compiling expo-image Pods/libwebp » idec_dec.c

› Compiling expo-image Pods/libwebp » huffman_utils.c

› Compiling expo-image Pods/libwebp » histogram_enc.c

› Compiling expo-image Pods/libwebp » frame_enc.c

› Compiling expo-image Pods/libwebp » frame_dec.c

› Compiling expo-image Pods/libwebp » filters_utils.c

› Compiling expo-image Pods/libwebp » filters_sse2.c

› Compiling expo-image Pods/libwebp » filters_neon.c

› Compiling expo-image Pods/libwebp » filters_msa.c

› Compiling expo-image Pods/libwebp » filters_mips_dsp_r2.c

› Compiling expo-image Pods/libwebp » filters.c

› Compiling expo-image Pods/libwebp » filter_enc.c

› Compiling expo-image Pods/libwebp » enc_sse41.c

› Compiling expo-image Pods/libwebp » enc_sse2.c

› Compiling expo-image Pods/libwebp » enc_neon.c

› Compiling expo-image Pods/libwebp » enc_msa.c

› Compiling expo-image Pods/libwebp » enc_mips_dsp_r2.c

› Compiling expo-image Pods/libwebp » enc_mips32.c

› Compiling expo-image Pods/libwebp » enc.c

› Compiling expo-image Pods/libwebp » demux.c

› Compiling expo-image Pods/libwebp » dec_sse41.c

› Compiling expo-image Pods/libwebp » dec_sse2.c

› Compiling expo-image Pods/libwebp » dec_neon.c

› Compiling expo-image Pods/libwebp » dec_msa.c

› Compiling expo-image Pods/libwebp » dec_mips_dsp_r2.c

› Compiling expo-image Pods/libwebp » dec_mips32.c

› Compiling expo-image Pods/libwebp » dec_clip_tables.c

› Compiling expo-image Pods/libwebp » dec.c

› Compiling expo-image Pods/libwebp » cpu.c

› Compiling expo-image Pods/libwebp » cost_sse2.c

› Compiling expo-image Pods/libwebp » cost_neon.c

› Compiling expo-image Pods/libwebp » cost_mips32.c

› Compiling expo-image Pods/libwebp » cost_enc.c

› Compiling expo-image Pods/libwebp » cost.c

› Compiling expo-image Pods/libwebp » config_enc.c

› Compiling expo-image Pods/libwebp » color_cache_utils.c

› Compiling expo-image Pods/libwebp » bit_writer_utils.c

› Compiling expo-image Pods/libwebp » bit_reader_utils.c

› Compiling expo-image Pods/libwebp » backward_references_cost_enc.c

› Compiling expo-image Pods/libwebp » anim_encode.c

› Compiling expo-image Pods/libwebp » anim_decode.c

› Compiling expo-image Pods/libwebp » analysis_enc.c

› Compiling expo-image Pods/libwebp » alpha_processing_sse41.c

› Compiling expo-image Pods/libwebp » alpha_processing_sse2.c

› Compiling expo-image Pods/libwebp » libwebp-dummy.m

› Compiling expo-image Pods/libwebp » alpha_processing_mips_dsp_r2.c

› Compiling expo-image Pods/libwebp » alpha_processing_neon.c

› Compiling expo-image Pods/libwebp » alpha_processing.c

› Compiling expo-image Pods/libwebp » alpha_enc.c

› Compiling expo-image Pods/libwebp » alpha_dec.c

› Packaging expo-image Pods/libwebp » liblibwebp.a

› Compiling expo-image Pods/libdav1d » wedge.c

› Compiling expo-image Pods/libdav1d » tables.c

› Compiling expo-image Pods/libdav1d » scan.c

› Compiling expo-image Pods/libdav1d » qm.c

› Compiling expo-image Pods/libdav1d » lf_mask.c

› Compiling expo-image Pods/libdav1d » warpmv.c

› Compiling expo-image Pods/libdav1d » refmvs.c

› Compiling expo-image Pods/libdav1d » thread_task.c

› Compiling expo-image Pods/libdav1d » ref.c

› Compiling expo-image Pods/libdav1d » recon_tmpl_16.c

› Compiling expo-image Pods/libdav1d » recon_tmpl.c

› Compiling expo-image Pods/libdav1d » picture.c

› Compiling expo-image Pods/libdav1d » obu.c

› Compiling expo-image Pods/libdav1d » msac.c

› Compiling expo-image Pods/libdav1d » mem.c

› Compiling expo-image Pods/libdav1d » mc_tmpl_16.c

› Compiling expo-image Pods/libdav1d » mc_tmpl.c

› Compiling expo-image Pods/libdav1d » lr_apply_tmpl_16.c

› Compiling expo-image Pods/libdav1d » lr_apply_tmpl.c

› Compiling expo-image Pods/libdav1d » looprestoration_tmpl_16.c

› Compiling expo-image Pods/libdav1d » looprestoration_tmpl.c

› Compiling expo-image Pods/libdav1d » loopfilter_tmpl_16.c

› Compiling expo-image Pods/libdav1d » loopfilter_tmpl.c

› Compiling expo-image Pods/libdav1d » log.c

› Compiling expo-image Pods/libdav1d » libdav1d-dummy.m

› Compiling expo-image Pods/libdav1d » lf_apply_tmpl_16.c

› Compiling expo-image Pods/libdav1d » lf_apply_tmpl.c

› Compiling expo-image Pods/libdav1d » itx_tmpl_16.c

› Compiling expo-image Pods/libdav1d » itx_tmpl.c

› Compiling expo-image Pods/libdav1d » itx_1d.c

› Compiling expo-image Pods/libdav1d » ipred_tmpl_16.c

› Compiling expo-image Pods/libdav1d » ipred_tmpl.c

› Compiling expo-image Pods/libdav1d » ipred_prepare_tmpl_16.c

› Compiling expo-image Pods/libdav1d » ipred_prepare_tmpl.c

› Compiling expo-image Pods/libdav1d » intra_edge.c

› Compiling expo-image Pods/libdav1d » filmgrain_tmpl_16.c

› Compiling expo-image Pods/libdav1d » filmgrain_tmpl.c

› Compiling expo-image Pods/libdav1d » fg_apply_tmpl_16.c

› Compiling expo-image Pods/libdav1d » dequant_tables.c

› Compiling expo-image Pods/libdav1d » fg_apply_tmpl.c

› Compiling expo-image Pods/libdav1d » data.c

› Compiling expo-image Pods/libdav1d » decode.c

› Compiling expo-image Pods/libdav1d » cpu.c

› Compiling expo-image Pods/libdav1d » cdf.c

› Compiling expo-image Pods/libdav1d » cdef_tmpl_16.c

› Compiling expo-image Pods/libdav1d » cpu.c

› Compiling expo-image Pods/libdav1d » cdef_tmpl.c

› Compiling expo-image Pods/libdav1d » cdef_apply_tmpl_16.c

› Compiling expo-image Pods/libdav1d » cdef_apply_tmpl.c

› Compiling write.c

› Compiling Pods/libavif » utils.c

› Compiling Pods/libavif » scale.c

› Compiling Pods/libavif » reformat_libyuv.c

› Compiling Pods/libavif » reformat_libsharpyuv.c

› Packaging expo-image Pods/libdav1d » liblibdav1d.a

› Compiling Pods/libavif » reformat.c

› Compiling Pods/libavif » rawdata.c

› Compiling Pods/libavif » obu.c

› Compiling Pods/libavif » io.c

› Compiling Pods/libavif » mem.c

› Compiling Pods/libavif » stream.c

› Compiling Pods/libavif » read.c

› Compiling Pods/libavif » exif.c

› Compiling Pods/libavif » diag.c

› Compiling Pods/libavif » colr.c

› Compiling Pods/libavif » codec_dav1d.c

› Compiling Pods/libavif » avif.c

› Compiling Pods/libavif » alpha.c

› Preparing Pods/expo-dev-launcher-EXDevLauncher » ResourceBundle-EXDevLauncher-expo-dev-launcher-Info.plist

› Compiling expo-image Pods/SDWebImageSVGCoder » SDWebImageSVGCoderDefine.m

› Compiling expo-image Pods/SDWebImageSVGCoder » SDWebImageSVGCoder-dummy.m

› Compiling expo-image Pods/SDWebImageSVGCoder » SDImageSVGCoder.m

› Compiling expo-image Pods/SDWebImageAVIFCoder » SDWebImageAVIFCoder-dummy.m

› Compiling Pods/libavif » libavif-dummy.m

› Compiling expo-image Pods/SDWebImageAVIFCoder » SDImageAVIFCoder.m

› Compiling expo-image Pods/SDWebImageAVIFCoder » Conversion.m

› Compiling expo-image Pods/SDWebImageAVIFCoder » ColorSpace.m

› Compiling expo-image Pods/SDWebImage » UIView+WebCacheOperation.m

› Compiling expo-image Pods/SDWebImage » UIView+WebCache.m

› Compiling expo-image Pods/SDWebImage » UIImageView+WebCache.m

› Compiling expo-image Pods/SDWebImage » UIImageView+HighlightedWebCache.m

› Compiling expo-image Pods/SDWebImageWebPCoder » UIImage+WebP.m

› Compiling expo-image Pods/SDWebImageWebPCoder » SDWebImageWebPCoderDefine.m

› Compiling expo-image Pods/SDWebImageWebPCoder » SDWebImageWebPCoder-dummy.m

› Compiling expo-image Pods/SDWebImageWebPCoder » SDImageWebPCoder.m

› Compiling expo-image Pods/SDWebImage » UIImage+Transform.m

› Compiling expo-image Pods/SDWebImage » UIImage+MultiFormat.m

› Compiling expo-image Pods/SDWebImage » UIImage+Metadata.m

› Compiling expo-image Pods/SDWebImage » UIImage+MemoryCacheCost.m

› Compiling expo-image Pods/SDWebImage » UIImage+GIF.m

› Compiling expo-image Pods/SDWebImage » UIImage+ForceDecode.m

› Compiling expo-image Pods/SDWebImage » UIImage+ExtendedCacheData.m

› Compiling expo-image Pods/SDWebImage » UIColor+SDHexString.m

› Compiling expo-image Pods/SDWebImage » SDWebImageTransition.m

› Compiling expo-image Pods/SDWebImage » UIButton+WebCache.m

› Compiling expo-image Pods/SDWebImage » SDWebImagePrefetcher.m

› Compiling expo-image Pods/SDWebImage » SDWebImageOptionsProcessor.m

› Compiling expo-image Pods/SDWebImage » SDWebImageOperation.m

› Compiling expo-image Pods/SDWebImage » SDWebImageManager.m

› Compiling expo-image Pods/SDWebImage » SDWebImageIndicator.m

› Compiling expo-image Pods/SDWebImage » SDWebImageError.m

› Compiling expo-image Pods/SDWebImage » SDWebImageDownloaderResponseModifier.m

› Compiling expo-image Pods/SDWebImage » SDWebImageDownloaderRequestModifier.m

› Compiling expo-image Pods/SDWebImage » SDWebImageDownloaderOperation.m

› Compiling expo-image Pods/SDWebImage » SDWebImageDownloaderConfig.m

› Compiling expo-image Pods/SDWebImage » SDWebImageDownloader.m

› Compiling expo-image Pods/SDWebImage » SDWebImageDefine.m

› Compiling expo-image Pods/SDWebImage » SDWebImageCompat.m

› Compiling expo-image Pods/SDWebImage » SDWebImageCacheSerializer.m

› Compiling expo-image Pods/SDWebImage » SDWebImageCacheKeyFilter.m

› Compiling expo-image Pods/SDWebImage » SDWebImage-dummy.m

› Compiling expo-image Pods/SDWebImage » SDWeakProxy.m

› Compiling expo-image Pods/SDWebImage » SDMemoryCache.m

› Compiling expo-image Pods/SDWebImage » SDInternalMacros.m

› Compiling expo-image Pods/SDWebImage » SDImageTransformer.m

› Compiling expo-image Pods/SDWebImage » SDImageLoadersManager.m

› Compiling expo-image Pods/SDWebImage » SDImageLoader.m

› Compiling expo-image Pods/SDWebImage » SDImageIOCoder.m

› Compiling expo-image Pods/SDWebImage » SDImageIOAnimatedCoder.m

› Compiling expo-image Pods/SDWebImage » SDImageHEICCoder.m

› Compiling expo-image Pods/SDWebImage » SDImageGraphics.m

› Compiling expo-image Pods/SDWebImage » SDImageFrame.m

› Compiling expo-image Pods/SDWebImage » SDImageFramePool.m

› Compiling expo-image Pods/SDWebImage » SDImageGIFCoder.m

› Compiling expo-image Pods/SDWebImage » SDImageCodersManager.m

› Compiling expo-image Pods/SDWebImage » SDImageCoderHelper.m

› Compiling expo-image Pods/SDWebImage » SDImageCoder.m

› Compiling expo-image Pods/SDWebImage » SDImageCachesManagerOperation.m

› Compiling expo-image Pods/SDWebImage » SDImageCachesManager.m

› Compiling expo-image Pods/SDWebImage » SDImageCacheDefine.m

› Compiling expo-image Pods/SDWebImage » SDImageCacheConfig.m

› Compiling expo-image Pods/SDWebImage » SDImageCache.m

› Compiling expo-image Pods/SDWebImage » SDImageAssetManager.m

› Compiling expo-image Pods/SDWebImage » SDImageAWebPCoder.m

› Compiling expo-image Pods/SDWebImage » SDImageAPNGCoder.m

› Compiling expo-image Pods/SDWebImage » SDGraphicsImageRenderer.m

› Compiling expo-image Pods/SDWebImage » SDFileAttributeHelper.m

› Compiling expo-image Pods/SDWebImage » SDDisplayLink.m

› Compiling expo-image Pods/SDWebImage » SDDeviceHelper.m

› Compiling expo-image Pods/SDWebImage » SDDiskCache.m

› Compiling expo-image Pods/SDWebImage » SDCallbackQueue.m

› Compiling expo-image Pods/SDWebImage » SDAsyncBlockOperation.m

› Compiling expo-image Pods/SDWebImage » SDAssociatedObject.m

› Compiling expo-image Pods/SDWebImage » SDAnimatedImageView.m

› Compiling expo-image Pods/SDWebImage » SDAnimatedImageView+WebCache.m

› Compiling expo-image Pods/SDWebImage » SDAnimatedImageRep.m

› Compiling expo-image Pods/SDWebImage » SDAnimatedImagePlayer.m

› Compiling expo-image Pods/SDWebImage » SDAnimatedImage.m

› Compiling expo-image Pods/SDWebImage » NSImage+Compatibility.m

› Compiling expo-image Pods/SDWebImage » NSData+ImageContentType.m

› Compiling expo-image Pods/SDWebImage » NSButton+WebCache.m

› Packaging expo-image Pods/SDWebImage » libSDWebImage.a

› Compiling expo-structured-headers Pods/EXStructuredHeaders » EXStructuredHeaders-dummy.m

› Compiling expo-structured-headers Pods/EXStructuredHeaders » EXStructuredHeadersParser.m

› Compiling expo-json-utils Pods/EXJSONUtils » NSDictionary+EXJSONUtils.m

› Compiling expo-json-utils Pods/EXJSONUtils » EXJSONUtils-dummy.m

› Packaging expo-json-utils Pods/EXJSONUtils » libEXJSONUtils.a

› Packaging Pods/libavif » liblibavif.a

› Executing react-native Pods/React-Core-prebuilt » [CP-User] [RNDeps] Replace React Native Core for the right configuration, if needed

› Packaging expo-structured-headers Pods/EXStructuredHeaders » libEXStructuredHeaders.a

› Compiling expo-dev-menu-interface Pods/expo-dev-menu-interface » expo-dev-menu-interface-dummy.m

› Packaging expo-dev-menu-interface Pods/expo-dev-menu-interface » libexpo-dev-menu-interface.a

› Compiling expo-updates Pods/ReachabilitySwift » ReachabilitySwift-dummy.m

› Executing expo-dev-menu-interface Pods/expo-dev-menu-interface » Copy generated compatibility header

› Packaging expo-updates Pods/ReachabilitySwift » libReachabilitySwift.a

› Creating  Pods/expo-dev-launcher-EXDevLauncher » EXDevLauncher.bundle

› Executing expo-updates Pods/ReachabilitySwift » Copy generated compatibility header

› Packaging expo-image Pods/SDWebImageWebPCoder » libSDWebImageWebPCoder.a

› Packaging expo-image Pods/SDWebImageSVGCoder » libSDWebImageSVGCoder.a

› Packaging expo-image Pods/SDWebImageAVIFCoder » libSDWebImageAVIFCoder.a

› Compiling react-native-iap Pods/openiap » openiap-dummy.m

› Packaging react-native-iap Pods/openiap » libopeniap.a

› Executing react-native-iap Pods/openiap » Copy generated compatibility header

› Executing react-native Pods/React-Core-prebuilt » [CP] Copy XCFrameworks

› Executing react-native Pods/React-RCTFBReactNativeSpec » [CP-User] [RN]Check FBReactNativeSpec

› Executing execudex Pods/ReactCodegen » [CP-User] Generate Specs

› Compiling Pods/Sentry » SentryTraceProfiler.mm

› Compiling Pods/Sentry » SentryTime.mm

› Compiling Pods/Sentry » UIViewController+Sentry.m

› Compiling Pods/Sentry » SentryThreadMetadataCache.cpp

› Compiling Pods/Sentry » SentryThreadHandle.cpp

› Compiling Pods/Sentry » SentryThread.mm

› Compiling Pods/Sentry » SentrySystemWrapper.mm

› Compiling Pods/Sentry » SentrySamplingProfiler.cpp

› Compiling Pods/Sentry » SentryProfilerState.mm

› Compiling Pods/Sentry » SentryProfiler.mm

› Compiling Pods/Sentry » SentryProfiledTracerConcurrency.mm

› Compiling Pods/Sentry » SentryProfileCollector.mm

› Compiling Pods/Sentry » SentryMachLogging.cpp

› Compiling Pods/Sentry » SentryError.mm

› Compiling SentryCrashMonitor_CPPException.cpp

› Compiling Pods/Sentry » SentryContinuousProfiler.mm

› Compiling Pods/Sentry » SentryBacktrace.cpp

› Compiling Pods/Sentry » SentyOptionsInternal.m

› Compiling Pods/Sentry » _SentryDispatchQueueWrapperInternal.m

› Compiling Pods/Sentry » SentryWatchdogTerminationTrackingIntegration.m

› Compiling Pods/Sentry » SentryWatchdogTerminationTracker.m

› Compiling Pods/Sentry » SentryWatchdogTerminationScopeObserver.m

› Compiling Pods/Sentry » SentryWatchdogTerminationLogic.m

› Compiling Pods/Sentry » SentryWatchdogTerminationBreadcrumbProcessor.m

› Compiling Pods/Sentry » SentryViewHierarchyProviderHelper.m

› Compiling Pods/Sentry » SentryViewHierarchyIntegration.m

› Compiling Pods/Sentry » SentryUserFeedbackIntegration.m

› Compiling Pods/Sentry » SentryUserAccess.m

› Compiling Pods/Sentry » SentryUser.m

› Compiling Pods/Sentry » SentryUncaughtNSExceptions.m

› Compiling Pods/Sentry » SentryUseNSExceptionCallstackWrapper.m

› Compiling Pods/Sentry » SentryUIViewControllerSwizzling.m

› Compiling Pods/Sentry » SentryUIViewControllerPerformanceTracker.m

› Compiling Pods/Sentry » SentryUIEventTrackingIntegration.m

› Compiling Pods/Sentry » SentryUIEventTrackerTransactionMode.m

› Compiling Pods/Sentry » SentryUIEventTracker.m

› Compiling Pods/Sentry » SentryTransportFactory.m

› Compiling Pods/Sentry » SentryTransportAdapter.m

› Compiling Pods/Sentry » SentryTransaction.m

› Compiling Pods/Sentry » SentryTransactionContext.m

› Compiling Pods/Sentry » SentryTracerConfiguration.m

› Compiling Pods/Sentry » SentryTracer.m

› Compiling Pods/Sentry » SentryTraceOrigin.m

› Compiling Pods/Sentry » SentryTraceHeader.m

› Compiling Pods/Sentry » SentryTraceContext.m

› Compiling Pods/Sentry » SentryThreadInspector.m

› Compiling Pods/Sentry » SentrySystemEventBreadcrumbs.m

› Compiling Pods/Sentry » SentrySwizzle.m

› Compiling Pods/Sentry » SentrySysctlObjC.m

› Compiling Pods/Sentry » SentrySwizzleWrapper.m

› Compiling Pods/Sentry » SentrySwiftAsyncIntegration.m

› Compiling Pods/Sentry » SentrySubClassFinder.m

› Compiling Pods/Sentry » SentryStacktraceBuilder.m

› Compiling Pods/Sentry » SentryStacktrace.m

› Compiling Pods/Sentry » SentrySpotlightTransport.m

› Compiling Pods/Sentry » SentrySpanStatus.m

› Compiling Pods/Sentry » SentrySpanId.m

› Compiling Pods/Sentry » SentrySpanDataKey.m

› Compiling Pods/Sentry » SentrySpanContext.m

› Compiling Pods/Sentry » SentrySpan.m

› Compiling Pods/Sentry » SentrySessionTracker.m

› Compiling Pods/Sentry » SentrySessionInternal.m

› Compiling Pods/Sentry » SentrySessionReplaySyncC.c

› Compiling Pods/Sentry » SentrySerialization.m

› Compiling Pods/Sentry » SentryScopeSyncC.c

› Compiling Pods/Sentry » SentryScreenFrames.m

› Compiling Pods/Sentry » SentryScope.m

› Compiling Pods/Sentry » SentrySamplingContext.m

› Compiling Pods/Sentry » SentrySamplerDecision.m

› Compiling Pods/Sentry » SentrySDKInternal.m

› Compiling Pods/Sentry » SentryRetryAfterHeaderParser.m

› Compiling Pods/Sentry » SentryRequest.m

› Compiling Pods/Sentry » SentryReplayApi.m

› Compiling Pods/Sentry » SentryReachability.m

› Compiling Pods/Sentry » SentryQueueableRequestManager.m

› Compiling Pods/Sentry » SentryPropagationContext.m

› Compiling Pods/Sentry » SentryProfilingSwiftHelpers.m

› Compiling Pods/Sentry » SentryProfilerTestHelpers.m

› Compiling Pods/Sentry » SentryProfilerSerialization.m

› Compiling Pods/Sentry » SentryProfileTimeseries.m

› Compiling Pods/Sentry » SentryProfileConfiguration.m

› Compiling Pods/Sentry » SentryPredicateDescriptor.m

› Compiling Pods/Sentry » SentryPerformanceTrackingIntegration.m

› Compiling Pods/Sentry » SentryPerformanceTracker.m

› Compiling Pods/Sentry » SentryOptions.m

› Compiling Pods/Sentry » SentryNetworkTrackingIntegration.m

› Compiling Pods/Sentry » SentryNetworkTracker.m

› Compiling Pods/Sentry » SentryNSURLRequestBuilder.m

› Compiling Pods/Sentry » SentryNSFileManagerSwizzling.m

› Compiling Pods/Sentry » SentryNSError.m

› Compiling Pods/Sentry » SentryNSDictionarySanitize.m

› Compiling Pods/Sentry » SentryMsgPackSerializer.m

› Compiling Pods/Sentry » SentryNSDataSwizzling.m

› Compiling Pods/Sentry » SentryNSDataUtils.m

› Compiling Pods/Sentry » SentryMetricProfiler.m

› Compiling Pods/Sentry » SentryMetricKitIntegration.m

› Compiling Pods/Sentry » SentryMeta.m

› Compiling Pods/Sentry » SentryMessage.m

› Compiling Pods/Sentry » SentryMechanismMeta.m

› Compiling Pods/Sentry » SentryMechanism.m

› Compiling Pods/Sentry » SentryLogC.m

› Compiling Pods/Sentry » SentryLevelMapper.m

› Compiling Pods/Sentry » SentryLevelHelper.m

› Compiling Pods/Sentry » SentryLaunchProfiling.m

› Compiling Pods/Sentry » SentryInstallation.m

› Compiling Pods/Sentry » SentryHttpTransport.m

› Compiling Pods/Sentry » SentryHttpStatusCodeRange.m

› Compiling Pods/Sentry » SentryGeo.m

› Compiling Pods/Sentry » SentryFramesTrackingIntegration.m

› Compiling Pods/Sentry » SentryFramesTracker.m

› Compiling Pods/Sentry » SentryFrame.m

› Compiling Pods/Sentry » SentryFileIOTrackingIntegration.m

› Compiling Pods/Sentry » SentryFileManager.m

› Compiling Pods/Sentry » SentryFileIOTracker.m

› Compiling Pods/Sentry » SentryExtraContextProvider.m

› Compiling Pods/Sentry » SentryEvent.m

› Compiling Pods/Sentry » SentryEnvelopeItemHeader.m

› Compiling Pods/Sentry » SentryEnvelopeRateLimit.m

› Compiling Pods/Sentry » SentryEnvelopeHeaderHelper.m

› Compiling Pods/Sentry » SentryEnvelopeAttachmentHeader.m

› Compiling Pods/Sentry » SentryDummyPublicEmptyClass.m

› Compiling Pods/Sentry » SentryDummyPrivateEmptyClass.m

› Compiling Pods/Sentry » SentryDisplayLinkWrapper.m

› Compiling Pods/Sentry » SentryDsn.m

› Compiling Pods/Sentry » SentryDiscardReasonMapper.m

› Compiling Pods/Sentry » SentryDispatchFactory.m

› Compiling Pods/Sentry » SentryDictionaryDeepSearch.m

› Compiling Pods/Sentry » SentryDevice.m

› Compiling Pods/Sentry » SentryDependencyContainerSwiftHelper.m

› Compiling Pods/Sentry » SentryDependencyContainer.m

› Compiling Pods/Sentry » SentryDelayedFrame.m

› Compiling Pods/Sentry » SentryDelayedFramesTracker.m

› Compiling Pods/Sentry » SentryDefaultRateLimits.m

› Compiling SentryDebugMeta.m

› Compiling Pods/Sentry » SentryDebugImageProvider.m

› Compiling Pods/Sentry » SentryDateUtils.m

› Compiling Pods/Sentry » SentryDataCategoryMapper.m

› Compiling SentryDateUtil.m

› Compiling Pods/Sentry » SentryCrashUUIDConversion.c

› Compiling Pods/Sentry » SentryCrashSysCtl.c

› Compiling Pods/Sentry » SentryCrashString.c

› Compiling Pods/Sentry » SentryCrashSymbolicator.c

› Compiling Pods/Sentry » SentryCrashStackEntryMapper.m

› Compiling Pods/Sentry » SentryCrashStackCursor_MachineContext.c

› Compiling SentryCrashStackCursor_Backtrace.c

› Compiling Pods/Sentry » SentryCrashThread.c

› Compiling Pods/Sentry » SentryCrashStackCursor.c

› Compiling Pods/Sentry » SentryCrashSignalInfo.c

› Compiling Pods/Sentry » SentryCrashReportStore.c

› Compiling Pods/Sentry » SentryCrashScopeObserver.m

› Compiling Pods/Sentry » SentryCrashReportFixer.c

› Compiling Pods/Sentry » SentryCrashReportSink.m

› Compiling Pods/Sentry » SentryCrashReportFilterBasic.m

› Compiling Pods/Sentry » SentryCrashReport.c

› Compiling Pods/Sentry » SentryCrashReportConverter.m

› Compiling Pods/Sentry » SentryCrashNSErrorUtil.m

› Compiling Pods/Sentry » SentryCrashMonitor_System.m

› Compiling Pods/Sentry » SentryCrashMonitor_Signal.c

› Compiling Pods/Sentry » SentryCrashMonitor_NSException.m

› Compiling Pods/Sentry » SentryCrashMonitorType.c

› Compiling Pods/Sentry » SentryCrashMonitor_AppState.c

› Compiling Pods/Sentry » SentryCrashMonitor.c

› Compiling Pods/Sentry » SentryCrashMemory.c

› Compiling Pods/Sentry » SentryCrashMachineContext.c

› Compiling Pods/Sentry » SentryCrashMach.c

› Compiling Pods/Sentry » SentryCrashJSONCodecObjC.m

› Compiling Pods/Sentry » SentryCrashJSONCodec.c

› Compiling Pods/Sentry » SentryCrashIntegrationSessionHandler.m

› Compiling Pods/Sentry » SentryCrashMach-O.c

› Compiling Pods/Sentry » SentryCrashIntegration.m

› Compiling Pods/Sentry » SentryCrashInstallationReporter.m

› Compiling Pods/Sentry » SentryCrashInstallation.m

› Compiling Pods/Sentry » SentryCrashID.c

› Compiling Pods/Sentry » SentryCrashExceptionApplicationHelper.m

› Compiling Pods/Sentry » SentryCrashDynamicLinker.c

› Compiling Pods/Sentry » SentryCrashExceptionApplication.m

› Compiling Pods/Sentry » SentryCrashDoctor.m

› Compiling Pods/Sentry » SentryCrashDebug.c

› Compiling Pods/Sentry » SentryCrashDefaultMachineContextWrapper.m

› Compiling Pods/Sentry » SentryCrashDefaultBinaryImageProvider.m

› Compiling Pods/Sentry » SentryCrashDate.c

› Compiling Pods/Sentry » SentryCrashCxaThrowSwapper.c

› Compiling Pods/Sentry » SentryCrashCPU_x86_64.c

› Compiling Pods/Sentry » SentryCrashCachedData.c

› Compiling Pods/Sentry » SentryCrashCPU_x86_32.c

› Compiling Pods/Sentry » SentryCrashCPU_arm64.c

› Compiling Pods/Sentry » SentryCrashCPU.c

› Compiling Pods/Sentry » SentryCrashC.c

› Compiling Pods/Sentry » SentryCrashBinaryImageCache.c

› Compiling Pods/Sentry » SentryCrash.m

› Compiling Pods/Sentry » SentryConcurrentRateLimitsDictionary.m

› Compiling Pods/Sentry » SentryClient.m

› Compiling Pods/Sentry » SentryByteCountFormatter.m

› Compiling Pods/Sentry » SentryBuildAppStartSpans.m

› Compiling Pods/Sentry » SentryBreadcrumbTracker.m

› Compiling Pods/Sentry » SentryBreadcrumb.m

› Compiling Pods/Sentry » SentryBinaryImageCacheCallbacks.m

› Compiling Pods/Sentry » SentryCoreDataTrackingIntegration.m

› Compiling Pods/Sentry » SentryCoreDataTracker.m

› Compiling Pods/Sentry » SentryCoreDataSwizzling.m

› Compiling Pods/Sentry » SentryBaseIntegration.m

› Compiling Pods/Sentry » SentryAutoSessionTrackingIntegration.m

› Compiling Pods/Sentry » SentryBaggage.m

› Compiling Pods/Sentry » SentryAutoBreadcrumbTrackingIntegration.m

› Compiling Pods/Sentry » SentryAttachment.m

› Compiling Pods/Sentry » SentryAsynchronousOperation.m

› Compiling Pods/Sentry » SentryAsyncSafeLog.c

› Compiling Pods/Sentry » SentryAsyncLog.m

› Compiling Pods/Sentry » SentryArray.m

› Compiling Pods/Sentry » SentryAppStateManager.m

› Compiling Pods/Sentry » SentryAppStartMeasurement.m

› Compiling Pods/Sentry » SentryAppStartTrackingIntegration.m

› Compiling Pods/Sentry » SentryANRTrackingIntegration.m

› Compiling Pods/Sentry » SentryANRTrackerV2.m

› Compiling Pods/Sentry » SentryANRTrackerV1.m

› Compiling Pods/Sentry » Sentry-dummy.m

› Compiling Pods/Sentry » PrivateSentrySDKOnly.m

› Compiling Pods/Sentry » NSMutableDictionary+Sentry.m

› Compiling execudex Pods/ReactCodegen » safeareacontextJSI-generated.cpp

› Compiling execudex Pods/ReactCodegen » safeareacontext-generated.mm

› Compiling execudex Pods/ReactCodegen » rnworkletsJSI-generated.cpp

› Compiling execudex Pods/ReactCodegen » rnworklets-generated.mm

› Compiling execudex Pods/ReactCodegen » rnscreensJSI-generated.cpp

› Packaging Pods/Sentry » libSentry.a

› Compiling execudex Pods/ReactCodegen » rnscreens-generated.mm

› Compiling execudex Pods/ReactCodegen » rngesturehandler_codegenJSI-generated.cpp

› Compiling execudex Pods/ReactCodegen » rngesturehandler_codegen-generated.mm

› Compiling execudex Pods/ReactCodegen » rnasyncstorageJSI-generated.cpp

› Compiling execudex Pods/ReactCodegen » rnasyncstorage-generated.mm

› Compiling execudex Pods/ReactCodegen » States.cpp

› Compiling execudex Pods/ReactCodegen » States.cpp

› Compiling execudex Pods/ReactCodegen » States.cpp

› Compiling execudex Pods/ReactCodegen » States.cpp

› Compiling execudex Pods/ReactCodegen » States.cpp

› Compiling execudex Pods/ReactCodegen » ShadowNodes.cpp

› Compiling execudex Pods/ReactCodegen » ShadowNodes.cpp

› Compiling execudex Pods/ReactCodegen » ShadowNodes.cpp

› Compiling execudex Pods/ReactCodegen » ShadowNodes.cpp

› Compiling execudex Pods/ReactCodegen » ShadowNodes.cpp

› Compiling execudex Pods/ReactCodegen » RNSentrySpecJSI-generated.cpp

› Compiling execudex Pods/ReactCodegen » RNSentrySpec-generated.mm

› Compiling execudex Pods/ReactCodegen » RNCWebViewSpecJSI-generated.cpp

› Compiling execudex Pods/ReactCodegen » RNCWebViewSpec-generated.mm

› Compiling execudex Pods/ReactCodegen » RCTUnstableModulesRequiringMainQueueSetupProvider.mm

› Compiling execudex Pods/ReactCodegen » RCTThirdPartyComponentsProvider.mm

› Compiling execudex Pods/ReactCodegen » RCTModulesConformingToProtocolsProvider.mm

› Compiling execudex Pods/ReactCodegen » RCTModuleProviders.mm

› Compiling execudex Pods/ReactCodegen » Props.cpp

› Compiling execudex Pods/ReactCodegen » Props.cpp

› Compiling execudex Pods/ReactCodegen » Props.cpp

› Compiling execudex Pods/ReactCodegen » Props.cpp

› Compiling execudex Pods/ReactCodegen » Props.cpp

› Compiling execudex Pods/ReactCodegen » NitroModulesSpecJSI-generated.cpp

› Compiling execudex Pods/ReactCodegen » NitroModulesSpec-generated.mm

› Compiling execudex Pods/ReactCodegen » EventEmitters.cpp

› Compiling execudex Pods/ReactCodegen » EventEmitters.cpp

› Compiling execudex Pods/ReactCodegen » EventEmitters.cpp

› Compiling execudex Pods/ReactCodegen » EventEmitters.cpp

› Compiling execudex Pods/ReactCodegen » EventEmitters.cpp

› Compiling execudex Pods/ReactCodegen » ComponentDescriptors.cpp

› Compiling execudex Pods/ReactCodegen » ComponentDescriptors.cpp

› Compiling execudex Pods/ReactCodegen » ComponentDescriptors.cpp

› Compiling execudex Pods/ReactCodegen » ComponentDescriptors.cpp

› Compiling execudex Pods/ReactCodegen » ComponentDescriptors.cpp

› Compiling react-native-webview Pods/react-native-webview » RNCWebViewModule.mm

› Compiling react-native-webview Pods/react-native-webview » RNCWebViewManager.mm

› Compiling react-native-webview Pods/react-native-webview » RNCWebView.mm

› Compiling execudex Pods/ReactCodegen » ReactCodegen-dummy.m

› Compiling react-native-webview Pods/react-native-webview » react-native-webview-dummy.m

› Executing Pods/Sentry » Copy generated compatibility header

› Compiling react-native-safe-area-context Pods/react-native-safe-area-context » RNCSafeAreaViewState.cpp

› Compiling react-native-safe-area-context Pods/react-native-safe-area-context » RNCSafeAreaViewShadowNode.cpp

› Compiling react-native-safe-area-context Pods/react-native-safe-area-context » RNCSafeAreaViewComponentView.mm

› Compiling react-native-safe-area-context Pods/react-native-safe-area-context » RNCSafeAreaProviderComponentView.mm

› Compiling react-native-safe-area-context Pods/react-native-safe-area-context » RNCSafeAreaContext.mm

› Packaging execudex Pods/ReactCodegen » libReactCodegen.a

› Compiling react-native-safe-area-context Pods/react-native-safe-area-context » react-native-safe-area-context-dummy.m

› Compiling execudex Pods/ReactAppDependencyProvider » RCTAppDependencyProvider.mm

› Compiling react-native-worklets Pods/RNWorklets » WorkletsVersion.cpp

› Compiling react-native-worklets Pods/RNWorklets » WorkletsModuleProxy.cpp

› Compiling react-native-worklets Pods/RNWorklets » WorkletsModule.mm

› Compiling execudex Pods/ReactAppDependencyProvider » ReactAppDependencyProvider-dummy.m

› Compiling react-native-worklets Pods/RNWorklets » WorkletsMessageThread.mm

› Packaging execudex Pods/ReactAppDependencyProvider » libReactAppDependencyProvider.a

› Compiling react-native-worklets Pods/RNWorklets » WorkletsJSIUtils.cpp

› Compiling react-native-worklets Pods/RNWorklets » WorkletRuntimeRegistry.cpp

› Compiling react-native-worklets Pods/RNWorklets » WorkletRuntimeDecorator.cpp

› Compiling react-native-worklets Pods/RNWorklets » WorkletRuntime.cpp

› Compiling react-native-worklets Pods/RNWorklets » WorkletHermesRuntime.cpp

› Compiling react-native-worklets Pods/RNWorklets » WorkletEventHandler.cpp

› Compiling react-native-worklets Pods/RNWorklets » ValueUnpacker.cpp

› Compiling react-native-worklets Pods/RNWorklets » UIScheduler.cpp

› Compiling react-native-worklets UIRuntimeDecorator.cpp

› Compiling react-native-worklets Pods/RNWorklets » SynchronizableUnpacker.cpp

› Compiling react-native-worklets Pods/RNWorklets » SynchronizableAccess.cpp

› Compiling react-native-worklets Pods/RNWorklets » SlowAnimations.mm

› Compiling react-native-worklets Pods/RNWorklets » Serializable.cpp

› Compiling react-native-worklets Pods/RNWorklets » RuntimeManager.cpp

› Compiling react-native-worklets Pods/RNWorklets » RuntimeData.cpp

› Compiling react-native-worklets Pods/RNWorklets » RNRuntimeWorkletDecorator.cpp

› Compiling react-native-worklets Pods/RNWorklets » PlatformLogger.mm

› Compiling react-native-worklets Pods/RNWorklets » JSScheduler.cpp

› Compiling react-native-worklets Pods/RNWorklets » JSIWorkletsModuleProxy.cpp

› Compiling react-native-worklets Pods/RNWorklets » JSISerializer.cpp

› Compiling react-native-worklets Pods/RNWorklets » IOSUIScheduler.mm

› Compiling react-native-worklets Pods/RNWorklets » EventLoop.cpp

› Compiling react-native-worklets Pods/RNWorklets » EventHandlerRegistry.cpp

› Compiling react-native-worklets Pods/RNWorklets » AsyncQueueImpl.cpp

› Compiling react-native-worklets Pods/RNWorklets » AnimationFrameQueue.mm

› Compiling react-native-worklets Pods/RNWorklets » AnimationFrameBatchinator.cpp

› Compiling @sentry/react-native Pods/RNSentry » RNSentryReplayUnmask.mm

› Compiling @sentry/react-native Pods/RNSentry » RNSentryReplayMask.mm

› Compiling @sentry/react-native Pods/RNSentry » RNSentryReplay.mm

› Compiling @sentry/react-native Pods/RNSentry » RNSentry.mm

› Compiling react-native-safe-area-context Pods/react-native-safe-area-context » RNCSafeAreaViewMode.m

› Compiling react-native-safe-area-context Pods/react-native-safe-area-context » RNCSafeAreaViewManager.m

› Compiling react-native-safe-area-context Pods/react-native-safe-area-context » RNCSafeAreaViewLocalData.m

› Compiling react-native-safe-area-context Pods/react-native-safe-area-context » RNCSafeAreaViewEdges.m

› Compiling react-native-safe-area-context Pods/react-native-safe-area-context » RNCSafeAreaViewEdgeMode.m

› Compiling react-native-safe-area-context Pods/react-native-safe-area-context » RNCSafeAreaView.m

› Compiling react-native-safe-area-context Pods/react-native-safe-area-context » RNCSafeAreaUtils.m

› Compiling react-native-safe-area-context Pods/react-native-safe-area-context » RNCSafeAreaShadowView.m

› Compiling react-native-safe-area-context Pods/react-native-safe-area-context » RNCSafeAreaProviderManager.m

› Compiling react-native-safe-area-context Pods/react-native-safe-area-context » RNCSafeAreaProvider.m

› Compiling react-native-safe-area-context Pods/react-native-safe-area-context » RNCOnInsetsChangeEvent.m

› Packaging react-native-safe-area-context Pods/react-native-safe-area-context » libreact-native-safe-area-context.a

› Compiling react-native-webview Pods/react-native-webview » RNCWebViewImpl.m

› Compiling react-native-webview Pods/react-native-webview » RNCWebViewDecisionManager.m

› Compiling react-native-webview Pods/react-native-webview » RNCWKProcessPoolManager.m

› Compiling react-native-webview Pods/react-native-webview » RCTConvert+WKDataDetectorTypes.m

› Packaging react-native-webview Pods/react-native-webview » libreact-native-webview.a

› Compiling react-native-screens Pods/RNScreens » UIWindow+RNScreens.mm

› Compiling react-native-screens Pods/RNScreens » UIViewController+RNScreens.mm

› Compiling react-native-screens Pods/RNScreens » UIView+RNSUtility.mm

› Compiling react-native-screens Pods/RNScreens » UIScrollView+RNScreens.mm

› Compiling react-native-screens Pods/RNScreens » UINavigationBar+RNSUtility.mm

› Compiling @sentry/react-native Pods/RNSentry » RNSentry-dummy.m

› Compiling react-native-screens Pods/RNScreens » RNSViewControllerInvalidator.mm

› Compiling react-native-screens Pods/RNScreens » RNSTabsScreenViewController.mm

› Compiling react-native-screens Pods/RNScreens » RNSTabBarControllerDelegate.mm

› Compiling react-native-screens Pods/RNScreens » RNSTabBarController.mm

› Compiling react-native-screens Pods/RNScreens » RNSTabBarAppearanceCoordinator.mm

› Compiling react-native-screens Pods/RNScreens » RNSSplitViewScreenShadowNode.cpp

› Compiling react-native-screens Pods/RNScreens » RNSSearchBar.mm

› Compiling react-native-screens Pods/RNScreens » RNSScrollViewHelper.mm

› Compiling react-native-screens Pods/RNScreens » RNSScrollViewFinder.mm

› Compiling react-native-screens Pods/RNScreens » RNSScreenWindowTraits.mm

› Compiling react-native-screens Pods/RNScreens » RNSScreenViewEvent.mm

› Compiling react-native-screens Pods/RNScreens » RNSScreenState.cpp

› Compiling react-native-screens Pods/RNScreens » RNSScreenStackHeaderSubviewShadowNode.cpp

› Compiling react-native-screens Pods/RNScreens » RNSScreenStackHeaderSubview.mm

› Compiling react-native-screens Pods/RNScreens » RNSScreenStackHeaderConfigState.cpp

› Compiling react-native-screens Pods/RNScreens » RNSScreenStackHeaderConfigShadowNode.cpp

› Compiling react-native-screens Pods/RNScreens » RNSScreenStackAnimator.mm

› Compiling react-native-screens Pods/RNScreens » RNSScreenStack.mm

› Compiling react-native-screens Pods/RNScreens » RNSScreenShadowNode.cpp

› Compiling react-native-screens Pods/RNScreens » RNSScreenRemovalListener.cpp

› Compiling react-native-screens Pods/RNScreens » RNSScreenNavigationContainer.mm

› Compiling react-native-screens Pods/RNScreens » RNSScreenFooter.mm

› Compiling react-native-screens Pods/RNScreens » RNSScreenContentWrapper.mm

› Compiling react-native-screens Pods/RNScreens » RNSScreenContainer.mm

› Compiling react-native-screens Pods/RNScreens » RNSScreen.mm

› Compiling react-native-screens Pods/RNScreens » RNSReactBaseView.mm

› Compiling react-native-screens Pods/RNScreens » RNSPercentDrivenInteractiveTransition.mm

› Compiling react-native-screens Pods/RNScreens » RNSModule.mm

› Compiling react-native-screens Pods/RNScreens » RNSModalScreenShadowNode.cpp

› Compiling react-native-screens Pods/RNScreens » RNSModalScreen.mm

› Compiling react-native-screens Pods/RNScreens » RNSInvalidatedComponentsRegistry.mm

› Compiling react-native-screens Pods/RNScreens » RNSHeaderHeightChangeEvent.mm

› Compiling react-native-screens Pods/RNScreens » RNSGammaStubs.mm

› Compiling react-native-screens Pods/RNScreens » RNSFullWindowOverlayShadowNode.cpp

› Compiling react-native-screens Pods/RNScreens » RNSFullWindowOverlay.mm

› Compiling react-native-screens Pods/RNScreens » RNSConvert.mm

› Compiling react-native-screens Pods/RNScreens » RNSConversions.mm

› Compiling react-native-screens Pods/RNScreens » RNSConversions-Fabric.mm

› Compiling react-native-screens Pods/RNScreens » RNSConversions-BottomTabs.mm

› Compiling react-native-screens Pods/RNScreens » RNSBottomTabsState.cpp

› Compiling react-native-screens Pods/RNScreens » RNSBottomTabsShadowNode.cpp

› Compiling react-native-screens Pods/RNScreens » RNSBottomTabsScreenEventEmitter.mm

› Compiling react-native-screens Pods/RNScreens » RNSBottomTabsScreenComponentViewManager.mm

› Compiling react-native-screens Pods/RNScreens » RNSBottomTabsScreenComponentView.mm

› Compiling react-native-screens Pods/RNScreens » RNSBottomTabsHostEventEmitter.mm

› Compiling react-native-screens Pods/RNScreens » RNSBottomTabsHostComponentViewManager.mm

› Compiling react-native-screens Pods/RNScreens » RNSBottomTabsHostComponentView.mm

› Compiling react-native-screens Pods/RNScreens » RNSBottomTabsHostComponentView+RNSImageLoader.mm

› Compiling react-native-screens Pods/RNScreens » RNSBackBarButtonItem.mm

› Compiling react-native-screens Pods/RNScreens » RCTTouchHandler+RNSUtility.mm

› Compiling react-native-screens Pods/RNScreens » RCTSurfaceTouchHandler+RNSUtility.mm

› Compiling react-native-screens Pods/RNScreens » RCTImageComponentView+RNSScreenStackHeaderConfig.mm

› Compiling react-native-screens Pods/RNScreens » RCTConvert+RNScreens.mm

› Compiling react-native-screens Pods/RNScreens » RCTConvert+RNSBottomTabs.mm

› Compiling react-native-screens Pods/RNScreens » NSString+RNSUtility.mm

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNNativeViewHandler.mm

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNGestureHandlerRootViewComponentView.mm

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNGestureHandlerModule.mm

› Compiling react-native-screens Pods/RNScreens » RNScreens-dummy.m

› Compiling react-native-worklets Pods/RNWorklets » RNWorklets-dummy.m

› Packaging react-native-worklets Pods/RNWorklets » libRNWorklets.a

› Packaging react-native-screens Pods/RNScreens » libRNScreens.a

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNGestureHandlerButtonManager.mm

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNGestureHandlerButtonComponentView.mm

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNGestureHandlerButton.mm

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNGestureHandler.mm

› Compiling @sentry/react-native Pods/RNSentry » RNSentryVersion.m

› Compiling @sentry/react-native Pods/RNSentry » RNSentryTimeToDisplay.m

› Compiling @sentry/react-native Pods/RNSentry » RNSentryRNSScreen.m

› Compiling @sentry/react-native Pods/RNSentry » RNSentryOnDrawReporter.m

› Compiling @sentry/react-native Pods/RNSentry » RNSentryFramesTrackerListener.m

› Compiling @sentry/react-native Pods/RNSentry » RNSentryEvents.m

› Compiling @sentry/react-native Pods/RNSentry » RNSentryDependencyContainer.m

› Compiling @sentry/react-native Pods/RNSentry » SentrySDKWrapper.m

› Compiling @sentry/react-native Pods/RNSentry » RNSentryReplayQuality.m

› Compiling @sentry/react-native Pods/RNSentry » RNSentryReplayBreadcrumbConverterHelper.m

› Compiling @sentry/react-native Pods/RNSentry » RNSentryReplayBreadcrumbConverter.m

› Compiling @sentry/react-native Pods/RNSentry » RNSentryId.m

› Compiling @sentry/react-native Pods/RNSentry » RNSentryExperimentalOptions.m

› Compiling @sentry/react-native Pods/RNSentry » RNSentryBreadcrumb.m

› Compiling @sentry/react-native Pods/RNSentry » RNSentry+fetchNativeStack.m

› Packaging @sentry/react-native Pods/RNSentry » libRNSentry.a

› Compiling @react-native-async-storage/async-storage Pods/RNCAsyncStorage » RNCAsyncStorage.mm

› Compiling @react-native-async-storage/async-storage Pods/RNCAsyncStorage » RNCAsyncStorage-dummy.m

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNRotationHandler.m

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNRootViewGestureRecognizer.m

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNPinchHandler.m

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNPanHandler.m

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNManualHandler.m

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNManualActivationRecognizer.m

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNLongPressHandler.m

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNHoverHandler.m

› Packaging @react-native-async-storage/async-storage Pods/RNCAsyncStorage » libRNCAsyncStorage.a

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNGestureHandlerRegistry.m

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNGestureHandlerPointerTracker.m

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNGestureHandlerEvents.m

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNGHVector.m

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNGHStylusData.m

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNForceTouchHandler.m

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNFlingHandler.m

› Compiling react-native-gesture-handler Pods/RNGestureHandler » RNGestureHandler-dummy.m

› Packaging react-native-gesture-handler Pods/RNGestureHandler » libRNGestureHandler.a

› Compiling react-native-nitro-modules Pods/NitroModules » ThreadPool.cpp

› Compiling react-native-nitro-modules Pods/NitroModules » ThreadUtils.mm

› Compiling react-native-nitro-modules Pods/NitroModules » ObjectUtils.cpp

› Compiling react-native-nitro-modules Pods/NitroModules » Promise.cpp

› Compiling react-native-nitro-modules Pods/NitroModules » NitroTypeInfo.cpp

› Compiling react-native-nitro-modules Pods/NitroModules » NitroLogger.mm

› Compiling react-native-nitro-modules Pods/NitroModules » NativeNitroModules+OldArch.mm

› Compiling react-native-nitro-modules Pods/NitroModules » NativeNitroModules+NewArch.mm

› Compiling react-native-nitro-modules Pods/NitroModules » JSICache.cpp

› Compiling react-native-nitro-modules Pods/NitroModules » InstallNitro.cpp

› Compiling react-native-nitro-modules Pods/NitroModules » HybridObjectRegistry.cpp

› Compiling react-native-nitro-modules Pods/NitroModules » HybridObjectPrototype.cpp

› Compiling react-native-nitro-modules Pods/NitroModules » HybridObject.cpp

› Compiling react-native-nitro-modules Pods/NitroModules » HybridNitroModulesProxy.cpp

› Compiling react-native-nitro-modules Pods/NitroModules » Dispatcher.cpp

› Compiling react-native-nitro-modules Pods/NitroModules » BoxedHybridObject.cpp

› Compiling react-native-nitro-modules ArrayBuffer.cpp

› Compiling react-native-nitro-modules Pods/NitroModules » AnyMap.cpp

› Compiling expo-modules-core Pods/ExpoModulesCore » TypedArray.cpp

› Compiling expo-modules-core Pods/ExpoModulesCore » SwiftUIVirtualViewObjC.mm

› Compiling expo-modules-core Pods/ExpoModulesCore » SharedRef.cpp

› Compiling react-native-nitro-modules Pods/NitroModules » NitroModules-dummy.m

› Compiling expo-modules-core Pods/ExpoModulesCore » ObjectDeallocator.cpp

› Compiling expo-modules-core Pods/ExpoModulesCore » NativeModule.cpp

› Compiling expo-modules-core Pods/ExpoModulesCore » MainThreadInvoker.mm

› Packaging react-native-nitro-modules Pods/NitroModules » libNitroModules.a

› Compiling expo-modules-core Pods/ExpoModulesCore » LazyObject.cpp

› Compiling expo-modules-core Pods/ExpoModulesCore » JSIUtils.cpp

› Compiling expo-modules-core Pods/ExpoModulesCore » ExpoViewShadowNode.cpp

› Compiling expo-modules-core Pods/ExpoModulesCore » ExpoViewProps.cpp

› Compiling expo-modules-core Pods/ExpoModulesCore » ExpoViewEventEmitter.cpp

› Compiling expo-modules-core Pods/ExpoModulesCore » ExpoViewComponentDescriptor.cpp

› Compiling expo-modules-core Pods/ExpoModulesCore » ExpoModulesHostObject.mm

› Compiling expo-modules-core Pods/ExpoModulesCore » ExpoFabricViewObjC.mm

› Compiling expo-modules-core Pods/ExpoModulesCore » ExpoBridgeModule.mm

› Compiling expo-modules-core Pods/ExpoModulesCore » EventEmitter.cpp

› Compiling expo-modules-core Pods/ExpoModulesCore » EXStringUtils.cpp

› Compiling expo-modules-core Pods/ExpoModulesCore » EXSharedObjectUtils.mm

› Compiling expo-modules-core Pods/ExpoModulesCore » EXReactNativeAdapter.mm

› Compiling expo-modules-core Pods/ExpoModulesCore » EXReactDelegateWrapper.mm

› Compiling expo-modules-core Pods/ExpoModulesCore » EXRawJavaScriptFunction.mm

› Compiling expo-modules-core Pods/ExpoModulesCore » EXNativeModulesProxy.mm

› Compiling expo-modules-core Pods/ExpoModulesCore » EXJavaScriptWeakObject.mm

› Compiling expo-modules-core Pods/ExpoModulesCore » EXJavaScriptValue.mm

› Compiling expo-modules-core Pods/ExpoModulesCore » EXJavaScriptTypedArray.mm

› Compiling expo-modules-core Pods/ExpoModulesCore » EXJavaScriptSharedObjectBinding.mm

› Compiling expo-modules-core Pods/ExpoModulesCore » EXJavaScriptRuntime.mm

› Compiling expo-modules-core Pods/ExpoModulesCore » EXJavaScriptObject.mm

› Compiling expo-modules-core Pods/ExpoModulesCore » EXJSIUtils.mm

› Compiling expo-modules-core Pods/ExpoModulesCore » EXJSIInstaller.mm

› Compiling expo-modules-core Pods/ExpoModulesCore » EXJSIConversions.mm

› Executing Copy generated compatibi

› Compiling expo-modules-core Pods/ExpoModulesCore » RCTComponentData+Privates.m

› Compiling expo-modules-core Pods/ExpoModulesCore » EXUtilities.m

› Compiling expo-modules-core Pods/ExpoModulesCore » EXSingletonModule.m

› Compiling expo-modules-core Pods/ExpoModulesCore » EXReactNativeUserNotificationCenterProxy.m

› Compiling expo-modules-core Pods/ExpoModulesCore » EXReactLogHandler.m

› Compiling expo-modules-core Pods/ExpoModulesCore » EXPermissionsService.m

› Compiling expo-modules-core Pods/ExpoModulesCore » EXPermissionsMethodsDelegate.m

› Compiling expo-modules-core Pods/ExpoModulesCore » EXModuleRegistryHolderReactModule.m

› Compiling expo-modules-core Pods/ExpoModulesCore » EXLogManager.m

› Compiling expo-modules-core Pods/ExpoModulesCore » EXExportedModule.m

› Compiling expo-modules-core Pods/ExpoModulesCore » EXAppDefines.m

› Compiling expo-modules-core Pods/ExpoModulesCore » CoreModuleHelper.m

› Compiling expo-modules-core Pods/ExpoModulesCore » EXModuleRegistryProvider.m

› Compiling expo-modules-core Pods/ExpoModulesCore » EXModuleRegistry.m

› Compiling expo-modules-core Pods/ExpoModulesCore » ExpoModulesCore-dummy.m

› Packaging expo-modules-core Pods/ExpoModulesCore » libExpoModulesCore.a

› Executing expo-modules-core Pods/ExpoModulesCore » Copy generated compatibility header

› Compiling expo-system-ui Pods/ExpoSystemUI » ExpoSystemUI-dummy.m

› Compiling expo-symbols Pods/ExpoSymbols » ExpoSymbols-dummy.m

› Compiling expo-splash-screen Pods/ExpoSplashScreen » ExpoSplashScreen-dummy.m

› Compiling expo-web-browser Pods/ExpoWebBrowser » ExpoWebBrowser-dummy.m

› Packaging expo-system-ui Pods/ExpoSystemUI » libExpoSystemUI.a

› Packaging expo-web-browser Pods/ExpoWebBrowser » libExpoWebBrowser.a

› Packaging expo-symbols Pods/ExpoSymbols » libExpoSymbols.a

› Packaging expo-splash-screen Pods/ExpoSplashScreen » libExpoSplashScreen.a

› Executing expo-web-browser Pods/ExpoWebBrowser » Copy generated compatibility header

› Executing expo-system-ui Pods/ExpoSystemUI » Copy generated compatibility header

› Executing expo-symbols Pods/ExpoSymbols » Copy generated compatibility header

› Executing expo-splash-screen Pods/ExpoSplashScreen » Copy generated compatibility header

› Compiling expo-linking Pods/ExpoLinking » ExpoLinking-dummy.m

› Packaging expo-linking Pods/ExpoLinking » libExpoLinking.a

› Executing expo-linking Pods/ExpoLinking » Copy generated compatibility header

› Compiling expo-keep-awake Pods/ExpoKeepAwake » ExpoKeepAwake-dummy.m

› Packaging expo-keep-awake Pods/ExpoKeepAwake » libExpoKeepAwake.a

› Executing expo-keep-awake Pods/ExpoKeepAwake » Copy generated compatibility header

› Compiling expo-router Pods/ExpoHead » LinkPreviewNativeNavigation.mm

› Compiling expo-haptics Pods/ExpoHaptics » ExpoHaptics-dummy.m

› Compiling expo-router Pods/ExpoHead » ExpoHead-dummy.m

› Packaging expo-haptics Pods/ExpoHaptics » libExpoHaptics.a

› Packaging expo-router Pods/ExpoHead » libExpoHead.a

› Executing expo-haptics Pods/ExpoHaptics » Copy generated compatibility header

› Executing expo-router Pods/ExpoHead » Copy generated compatibility header

› Compiling expo-font Pods/ExpoFont » ExpoFont-dummy.m

› Packaging expo-font Pods/ExpoFont » libExpoFont.a

› Executing expo-font Pods/ExpoFont » Copy generated compatibility header

› Compiling expo-blur Pods/ExpoBlur » ExpoBlur-dummy.m

› Packaging expo-blur Pods/ExpoBlur » libExpoBlur.a

› Executing expo-blur Pods/ExpoBlur » Copy generated compatibility header

› Compiling expo-device Pods/ExpoDevice » ExpoDevice-dummy.m

› Packaging expo-device Pods/ExpoDevice » libExpoDevice.a

› Executing expo-device Pods/ExpoDevice » Copy generated compatibility header

› Compiling expo-asset Pods/ExpoAsset » ExpoAsset-dummy.m

› Packaging expo-asset Pods/ExpoAsset » libExpoAsset.a

› Executing expo-asset Pods/ExpoAsset » Copy generated compatibility header

› Executing expo-constants Pods/EXConstants » [CP-User] Generate app.config for prebuilt Constants.manifest

› Compiling expo-file-system Pods/ExpoFileSystem » NSData+EXFileSystem.m

› Compiling expo-file-system Pods/ExpoFileSystem » ExpoFileSystem-dummy.m

› Compiling expo-file-system Pods/ExpoFileSystem » EXTaskHandlersManager.m

› Compiling expo-file-system Pods/ExpoFileSystem » EXSessionUploadTaskDelegate.m

› Compiling expo-file-system Pods/ExpoFileSystem » EXSessionTaskDispatcher.m

› Compiling expo-file-system Pods/ExpoFileSystem » EXSessionTaskDelegate.m

› Compiling expo-file-system Pods/ExpoFileSystem » EXSessionResumableDownloadTaskDelegate.m

› Compiling expo-file-system Pods/ExpoFileSystem » EXSessionHandler.m

› Compiling expo-file-system Pods/ExpoFileSystem » EXSessionDownloadTaskDelegate.m

› Compiling expo-updates-interface Pods/EXUpdatesInterface » noop-file.m

› Compiling expo-updates-interface Pods/EXUpdatesInterface » EXUpdatesInterface-dummy.m

› Packaging expo-updates-interface Pods/EXUpdatesInterface » libEXUpdatesInterface.a

› Compiling expo Pods/Expo » EXReactRootViewFactory.mm

› Compiling expo Pods/Expo » EXAppDelegateWrapper.mm

› Compiling expo-image Pods/ExpoImage » ExpoImage-dummy.m

› Compiling expo Pods/Expo » Expo-dummy.m

› Packaging expo-image Pods/ExpoImage » libExpoImage.a

› Compiling expo-file-system Pods/ExpoFileSystem » EXFileSystemLocalFileHandler.m

› Compiling expo-file-system Pods/ExpoFileSystem » EXFileSystemAssetLibraryHandler.m

› Packaging expo-file-system Pods/ExpoFileSystem » libExpoFileSystem.a

› Executing expo-image Pods/ExpoImage » Copy generated compatibility header

› Executing expo-file-system Pods/ExpoFileSystem » Copy generated compatibility header

› Executing Copy generated compatibility header

› Compiling expo-manifests Pods/EXManifests » EXManifests-dummy.m

› Executing Copy generated compatibility header

› Compiling expo Pods/Expo » EXLegacyAppDelegateWrapper.m

› Compiling expo Pods/Expo » EXAppDelegatesLoader.m

› Packaging expo Pods/Expo » libExpo.a

› Executing expo Pods/Expo » Copy generated compatibility header

› Compiling expo-constants Pods/EXConstants » EXConstantsService.m

› Compiling expo-constants Pods/EXConstants » EXConstantsInstallationIdProvider.m

› Packaging expo-constants Pods/EXConstants » libEXConstants.a

› Compiling expo-application Pods/EXApplication » EXProvisioningProfile.m

› Compiling expo-application Pods/EXApplication » EXApplication-dummy.m

› Executing expo-constants Pods/EXConstants » Copy generated compatibility header

› Compiling expo-eas-client Pods/EASClient » EASClient-dummy.m

› Packaging expo-application Pods/EXApplication » libEXApplication.a

› Packaging expo-eas-client Pods/EASClient » libEASClient.a

› Executing expo-application Pods/EXApplication » Copy generated compatibility header

› Executing expo-eas-client Pods/EASClient » Copy generated compatibility header

› Executing expo-updates Pods/EXUpdates » [CP-User] Generate updates resources for expo-updates

› Compiling react-native-iap Pods/NitroIap » NitroIapAutolinking.mm

› Compiling react-native-iap Pods/NitroIap » NitroIap-Swift-Cxx-Bridge.cpp

› Compiling react-native-iap Pods/NitroIap » HybridRnIapSpecSwift.cpp

› Compiling react-native-iap Pods/NitroIap » HybridRnIapSpec.cpp

› Compiling react-native-iap Pods/NitroIap » NitroIap-dummy.m

› Compiling expo-dev-menu Pods/expo-dev-menu » DevClientNoOpLoadingView.m

› Compiling expo-dev-menu Pods/expo-dev-menu » expo-dev-menu-dummy.m

› Compiling expo-dev-menu Pods/expo-dev-menu » EXDevMenuAppInfo.m

› Packaging expo-dev-menu Pods/expo-dev-menu » libexpo-dev-menu.a

› Executing expo-dev-menu Pods/expo-dev-menu » Copy generated compatibility header


⚠️  (../../../../React-Core-prebuilt/React.framework/Headers/React_Core/React_Core-umbrella.h:288:1)

<module-includes>:1:9: note: in file included from <module-includes>:1:
^ umbrella header for module 'React' does not include header 'RCTEventDispatcherProtocol.h'

› Packaging react-native-iap Pods/NitroIap » libNitroIap.a

› Executing react-native-iap Pods/NitroIap » Copy generated compatibility header

› Compiling expo-updates Pods/EXUpdates » EXUpdates-dummy.m

› Compiling expo-updates Pods/EXUpdates » EXDeferredRCTRootView.m

› Packaging expo-updates Pods/EXUpdates » libEXUpdates.a

› Executing expo-updates Pods/EXUpdates » Copy generated compatibility header

› Compiling expo-dev-launcher Pods/expo-dev-launcher » RCTPackagerConnection+EXDevLauncherPackagerConnectionInterceptor.m

› Compiling expo-dev-launcher Pods/expo-dev-launcher » EXDevLauncherReactNativeFactory.mm

› Compiling expo-dev-launcher Pods/expo-dev-launcher » expo-dev-launcher-dummy.m

› Compiling expo-dev-launcher Pods/expo-dev-launcher » EXDevLauncherRCTDevSettings.m

› Compiling expo-dev-launcher Pods/expo-dev-launcher » EXDevLauncherUpdatesHelper.m

› Compiling expo-dev-launcher Pods/expo-dev-launcher » EXDevLauncherDeferredRCTRootView.m

› Compiling expo-dev-launcher Pods/expo-dev-launcher » EXDevLauncherRCTBridge.m

› Compiling expo-dev-launcher Pods/expo-dev-launcher » EXDevLauncherDevMenuExtensions.m

› Compiling expo-dev-launcher Pods/expo-dev-launcher » EXDevLauncherRedBox.m

› Compiling expo-dev-launcher Pods/expo-dev-launcher » EXDevLauncherManifestParser.m

› Compiling expo-dev-launcher Pods/expo-dev-launcher » EXDevLauncher.m

› Compiling expo-dev-launcher Pods/expo-dev-launcher » EXDevLauncherController.m

› Packaging expo-dev-launcher Pods/expo-dev-launcher » libexpo-dev-launcher.a

› Executing expo-dev-launcher Pods/expo-dev-launcher » Copy generated compatibility header

› Compiling Pods/Pods-Execudex » Pods-Execudex-dummy.m

› Packaging Pods/Pods-Execudex » libPods-Execudex.a

› Executing Execudex » [CP] Check Pods Manifest.lock

› Executing Execudex » [Expo] Configure project

› Copying   ./PrivacyInfo.xcprivacy ➜ ../../../Users/expo/workingdir/build/ios/Execudex/PrivacyInfo.xcprivacy

› Copying   ios/Execudex/Supporting/Expo.plist ➜ ./Expo.plist

› Compiling Execudex » SplashScreen.storyboard

› Compiling Execudex » Execudex_vers.c

› Linking   Execudex » Execudex

⚠️  ld: ignoring duplicate libraries: '-lc++'

› Preparing Execudex » Info.plist

› Generating debug Execudex » Execudex.app.dSYM

› Executing Execudex » Bundle React Native code and images


❌  error: sentry-cli - To disable source maps auto upload, set SENTRY_DISABLE_AUTO_UPLOAD=true in your environment variables. Or to allow failing upload, set SENTRY_ALLOW_FAILURE=true


❌  error: sentry-cli -   INFO    2025-12-14 18:30:23.731630 -08:00 Loaded file referenced by SENTRY_PROPERTIES (sentry.properties)


❌  error: Auth token is required for this request. Please run `sentry-cli login` and try again!

    Run script build phase '[CP-User] [Hermes] Replace Hermes for the right configuration, if needed' will be run during every build because it does not specify any outputs. To address this issue, either add output dependencies to the script phase, or configure it to run in every build by unchecking "Based on dependency analysis" in the script phase. (in target 'hermes-engine' from project 'Pods')

    Run script build phase 'Upload Debug Symbols to Sentry' will be run during every build because it does not specify any outputs. To address this issue, either add output dependencies to the script phase, or configure it to run in every build by unchecking "Based on dependency analysis" in the script phase. (in target 'Execudex' from project 'Execudex')

    Run script build phase '[CP-User] Generate updates resources for expo-updates' will be run during every build because it does not specify any outputs. To address this issue, either add output dependencies to the script phase, or configure it to run in every build by unchecking "Based on dependency analysis" in the script phase. (in target 'EXUpdates' from project 'Pods')

▸ ** ARCHIVE FAILED **

▸ The following build commands failed:

▸ 	PhaseScriptExecution Bundle\ React\ Native\ code\ and\ images /Users/expo/Library/Developer/Xcode/DerivedData/Execudex-cjoyvujbewkrleeypphkmapplywt/Build/Intermediates.noindex/ArchiveIntermediates/Execudex/IntermediateBuildFilesPath/Execudex.build/Release-iphoneos/Execudex.build/Script-00DD1BFF1BD5951E006B06BC.sh (in target 'Execudex' from project 'Execudex')

▸ 	Archiving workspace Execudex with scheme Execudex

▸ (2 failures)
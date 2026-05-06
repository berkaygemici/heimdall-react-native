#import "HeimdallNative.h"
#import <React/RCTLog.h>
#import <sys/utsname.h>
#import <mach/mach.h>
#import <KSCrash/KSCrash.h>
#import <KSCrash/KSCrashReportFilterBasic.h>

@implementation HeimdallNative

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

RCT_EXPORT_METHOD(startNativeHandler) {
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            KSCrash *handler = [KSCrash sharedInstance];
            [handler install];
            RCTLogInfo(@"[Heimdall] Native crash handler installed");
        } @catch (NSException *exception) {
            RCTLogWarn(@"[Heimdall] Failed to install native crash handler: %@", exception.reason);
        }
    });
}

RCT_EXPORT_METHOD(getPendingCrashReports:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        KSCrash *handler = [KSCrash sharedInstance];
        
        [handler reportCount];
        
        [handler allReports:^(NSArray *reports) {
            if (!reports || reports.count == 0) {
                resolve(@[]);
                return;
            }
            
            NSMutableArray *parsed = [NSMutableArray array];
            
            for (NSDictionary *report in reports) {
                @try {
                    NSDictionary *crash = report[@"crash"];
                    NSDictionary *error = crash[@"error"];
                    NSArray *threads = crash[@"threads"];
                    
                    NSString *type = error[@"type"] ?: @"Unknown";
                    NSString *reason = error[@"reason"] ?: @"Native crash";
                    
                    if ([type isEqualToString:@"nsexception"]) {
                        NSDictionary *nsException = error[@"nsexception"];
                        if (nsException) {
                            type = nsException[@"name"] ?: type;
                            reason = nsException[@"reason"] ?: reason;
                        }
                    } else if ([type isEqualToString:@"signal"]) {
                        NSDictionary *signal = error[@"signal"];
                        if (signal) {
                            type = signal[@"name"] ?: type;
                        }
                    } else if ([type isEqualToString:@"mach"]) {
                        NSDictionary *mach = error[@"mach"];
                        if (mach) {
                            type = mach[@"exception_name"] ?: type;
                        }
                    }
                    
                    NSMutableArray *stacktrace = [NSMutableArray array];
                    
                    NSDictionary *crashedThread = nil;
                    for (NSDictionary *thread in threads) {
                        if ([thread[@"crashed"] boolValue]) {
                            crashedThread = thread;
                            break;
                        }
                    }
                    
                    NSArray *backtrace = crashedThread[@"backtrace"][@"contents"];
                    if (backtrace) {
                        for (NSDictionary *frame in backtrace) {
                            [stacktrace addObject:@{
                                @"filename": frame[@"object_name"] ?: @"<unknown>",
                                @"function": frame[@"symbol_name"] ?: @"<unknown>",
                                @"lineno": frame[@"instruction_addr"] ?: @0,
                                @"colno": @0,
                                @"in_app": @(![frame[@"object_name"] hasPrefix:@"/usr"])
                            }];
                        }
                    }
                    
                    [parsed addObject:@{
                        @"type": type,
                        @"value": reason,
                        @"stacktrace": stacktrace
                    }];
                } @catch (NSException *exception) {
                    RCTLogWarn(@"[Heimdall] Failed to parse crash report: %@", exception.reason);
                }
            }
            
            // Delete the reports after reading
            [handler deleteAllReports];
            
            resolve(parsed);
        }];
    } @catch (NSException *exception) {
        resolve(@[]);
    }
}

RCT_EXPORT_METHOD(getDeviceInfo:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        struct utsname systemInfo;
        uname(&systemInfo);
        NSString *model = [NSString stringWithCString:systemInfo.machine encoding:NSUTF8StringEncoding];
        
        NSString *osVersion = [[UIDevice currentDevice] systemVersion];
        
        mach_port_t hostPort = mach_host_self();
        vm_size_t pageSize;
        host_page_size(hostPort, &pageSize);
        
        vm_statistics64_data_t vmStats;
        mach_msg_type_number_t infoCount = HOST_VM_INFO64_COUNT;
        host_statistics64(hostPort, HOST_VM_INFO64, (host_info64_t)&vmStats, &infoCount);
        
        unsigned long long freeMemory = (unsigned long long)vmStats.free_count * (unsigned long long)pageSize;
        
        NSDictionary *attrs = [[NSFileManager defaultManager] attributesOfFileSystemForPath:NSHomeDirectory() error:nil];
        unsigned long long freeDisk = [attrs[NSFileSystemFreeSize] unsignedLongLongValue];
        
        resolve(@{
            @"model": model ?: @"Unknown",
            @"osVersion": osVersion ?: @"Unknown",
            @"freeMemory": @(freeMemory),
            @"freeDisk": @(freeDisk)
        });
    } @catch (NSException *exception) {
        resolve(@{
            @"model": @"Unknown",
            @"osVersion": @"Unknown",
            @"freeMemory": @0,
            @"freeDisk": @0
        });
    }
}

@end

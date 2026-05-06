require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = "heimdall-react-native"
  s.version      = package['version']
  s.summary      = package['description']
  s.homepage     = "https://github.com/heimdall-rn/heimdall-react-native"
  s.license      = package['license']
  s.author       = "Heimdall"
  s.platform     = :ios, "13.0"
  s.source       = { :git => "https://github.com/heimdall-rn/heimdall-react-native.git", :tag => s.version }
  s.source_files = "ios/**/*.{h,m}"

  s.dependency "React-Core"
  s.dependency "KSCrash", "~> 2.0"
end

Pod::Spec.new do |s|
  s.name = 'LibrioMedia'
  s.version = '1.0.0'
  s.summary = 'Local media thumbnails for Librio'
  s.homepage = 'https://github.com/IcaroMatheusz/Librio'
  s.license = { :type => 'MIT' }
  s.author = 'Librio'
  s.source = { :git => 'https://github.com/IcaroMatheusz/Librio.git' }
  s.platform = :ios, '16.4'
  s.source_files = '**/*.{swift,h,m,mm}'
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'PDFKit', 'UIKit'
end

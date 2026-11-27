import ExpoModulesCore
import PDFKit
import UIKit

public class LibrioMediaModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LibrioMedia")

    AsyncFunction("renderPdfCover") { (input: URL, output: URL) in
      let source = try self.privateURL(input)
      let destination = try self.privateURL(output)
      guard let page = PDFDocument(url: source)?.page(at: 0) else {
        throw CocoaError(.fileReadCorruptFile)
      }
      let bounds = page.bounds(for: .cropBox)
      guard bounds.width > 0 && bounds.height > 0 else {
        throw CocoaError(.fileReadCorruptFile)
      }
      let scale = 480 / max(bounds.width, bounds.height)
      let size = CGSize(width: max(1, bounds.width * scale), height: max(1, bounds.height * scale))
      let data = page.thumbnail(of: size, for: .cropBox).jpegData(compressionQuality: 0.85)
      guard let data else { throw CocoaError(.fileWriteUnknown) }
      try data.write(to: destination, options: .atomic)
    }
  }

  private func privateURL(_ url: URL) throws -> URL {
    let resolved = url.resolvingSymlinksInPath().standardizedFileURL
    let roots = [.documentDirectory, .cachesDirectory] as [FileManager.SearchPathDirectory]
    guard url.isFileURL && roots.contains(where: { directory in
      guard let root = FileManager.default.urls(for: directory, in: .userDomainMask).first else { return false }
      return resolved.path.hasPrefix(root.resolvingSymlinksInPath().path + "/")
    }) else { throw CocoaError(.fileReadNoPermission) }
    return resolved
  }
}

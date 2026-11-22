import AppKit
import Foundation
import WebKit

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(EXIT_FAILURE)
}

let args = CommandLine.arguments
guard (5...6).contains(args.count), let url = URL(string: args[1]), let scheme = url.scheme,
      ["http", "https", "file"].contains(scheme),
      let width = Double(args[2]), width >= 240,
      let height = Double(args[3]), height >= 240 else {
    fail("usage: measure <URL> <width> <height> <output-prefix>")
}
let prefix = args[4]
let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
let configuration = WKWebViewConfiguration()
configuration.mediaTypesRequiringUserActionForPlayback = []
configuration.websiteDataStore = .nonPersistent()
let rect = NSRect(x: 0, y: 0, width: width, height: height)
let view = WKWebView(frame: rect, configuration: configuration)
let hiddenWindow = NSWindow(contentRect:rect,styleMask:[.borderless],backing:.buffered,defer:false)
hiddenWindow.contentView = view
hiddenWindow.makeFirstResponder(view)
let metrics = try! String(contentsOf: URL(fileURLWithPath: CommandLine.arguments[0]).deletingLastPathComponent().appendingPathComponent("webkit-metrics.js"), encoding:.utf8)
final class Probe: NSObject, WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { fail(error.localizedDescription) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { fail(error.localizedDescription) }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.25) {
            webView.callAsyncJavaScript("await document.fonts.ready; " + metrics, arguments: [:], in: nil, in: .page) { result in
                do {
                    let data = try JSONSerialization.data(withJSONObject: result.get() as Any, options: [.prettyPrinted,.sortedKeys,.withoutEscapingSlashes])
                    try data.write(to: URL(fileURLWithPath: prefix + ".json"), options:.atomic)
                } catch { fail("metrics: " + String(describing:(error as NSError).userInfo)) }
                if args.count == 6 && args[5] == "metrics" { print(prefix); exit(EXIT_SUCCESS) }
                let snapshot = WKSnapshotConfiguration()
                snapshot.rect = rect
                webView.takeSnapshot(with:snapshot) { image, error in
                    guard let image, let tiff = image.tiffRepresentation, let bmp = NSBitmapImageRep(data:tiff),
                          let png = bmp.representation(using:.png,properties:[:]) else {
                        fail("snapshot: " + (error?.localizedDescription ?? "empty"))
                    }
                    do { try png.write(to:URL(fileURLWithPath:prefix + ".png"),options:.atomic) }
                    catch { fail("snapshot write: " + error.localizedDescription) }
                    print("saved " + prefix + ".json and .png")
                    exit(EXIT_SUCCESS)
                }
            }
        }
    }
}
let probe = Probe()
view.navigationDelegate = probe
if url.isFileURL {
    view.loadFileURL(url, allowingReadAccessTo:url.deletingLastPathComponent())
} else {
    view.load(URLRequest(url:url,cachePolicy:.reloadIgnoringLocalCacheData,timeoutInterval:20))
}
DispatchQueue.main.asyncAfter(deadline:.now() + 30) { fail("timeout while loading page or measuring layout") }
app.run()

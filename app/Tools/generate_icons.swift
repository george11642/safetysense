// Generates the SafetySense app icons as 1024 px PNGs with CoreGraphics.
// Usage: swift app/Tools/generate_icons.swift app/SafetySense/Resources/Assets.xcassets
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let outRoot = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "."

func rgb(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255, alpha: a)
}

func makeContext() -> CGContext {
    let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                        space: CGColorSpace(name: CGColorSpace.sRGB)!,
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    ctx.setShouldAntialias(true)
    ctx.interpolationQuality = .high
    return ctx
}

func write(_ ctx: CGContext, to path: String) {
    let url = URL(fileURLWithPath: path)
    try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
    CGImageDestinationFinalize(dest)
    print("wrote \(path)")
}

/// Soft shield: rounded top, tapering to a point.
func shieldPath(center: CGPoint, width w: CGFloat, height h: CGFloat) -> CGPath {
    let p = CGMutablePath()
    let top = center.y + h * 0.5, bottom = center.y - h * 0.5
    let left = center.x - w / 2, right = center.x + w / 2
    let shoulder = top - h * 0.12
    p.move(to: CGPoint(x: center.x, y: top))
    p.addCurve(to: CGPoint(x: right, y: shoulder),
               control1: CGPoint(x: center.x + w * 0.22, y: top), control2: CGPoint(x: right, y: top - h * 0.02))
    p.addCurve(to: CGPoint(x: center.x, y: bottom),
               control1: CGPoint(x: right, y: center.y - h * 0.18), control2: CGPoint(x: center.x + w * 0.2, y: bottom + h * 0.08))
    p.addCurve(to: CGPoint(x: left, y: shoulder),
               control1: CGPoint(x: center.x - w * 0.2, y: bottom + h * 0.08), control2: CGPoint(x: left, y: center.y - h * 0.18))
    p.addCurve(to: CGPoint(x: center.x, y: top),
               control1: CGPoint(x: left, y: top - h * 0.02), control2: CGPoint(x: center.x - w * 0.22, y: top))
    p.closeSubpath()
    return p
}

// MARK: Primary icon: Sandia-pink shield inside a soft ring on the night background.
do {
    let ctx = makeContext()
    let s = CGFloat(size)
    let c = CGPoint(x: s / 2, y: s / 2)
    // Background: night with a gentle radial lift.
    ctx.setFillColor(rgb(0x14131F)); ctx.fill(CGRect(x: 0, y: 0, width: s, height: s))
    let bg = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: [rgb(0x2B2440), rgb(0x14131F)] as CFArray, locations: [0, 1])!
    ctx.drawRadialGradient(bg, startCenter: CGPoint(x: c.x, y: c.y + 80), startRadius: 0, endCenter: c, endRadius: s * 0.72, options: [.drawsAfterEndLocation])

    // Outer ring (pink, soft glow).
    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: 60, color: rgb(0xEF7B9B, 0.55))
    ctx.setStrokeColor(rgb(0xEF7B9B, 0.9)); ctx.setLineWidth(34)
    ctx.strokeEllipse(in: CGRect(x: c.x - 330, y: c.y - 330, width: 660, height: 660))
    ctx.restoreGState()
    // Faint inner ring (teal, calm).
    ctx.setStrokeColor(rgb(0x5CC7B2, 0.35)); ctx.setLineWidth(10)
    ctx.strokeEllipse(in: CGRect(x: c.x - 268, y: c.y - 268, width: 536, height: 536))

    // Shield with vertical pink gradient.
    let shield = shieldPath(center: CGPoint(x: c.x, y: c.y - 6), width: 360, height: 420)
    ctx.saveGState()
    ctx.addPath(shield); ctx.clip()
    let g = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: [rgb(0xF6A3B9), rgb(0xEF7B9B), rgb(0xD95F84)] as CFArray, locations: [0, 0.55, 1])!
    ctx.drawLinearGradient(g, start: CGPoint(x: c.x, y: c.y + 220), end: CGPoint(x: c.x, y: c.y - 220), options: [])
    ctx.restoreGState()

    // Small "pulse" dot: someone is listening for you.
    ctx.setFillColor(rgb(0x14131F, 0.9))
    ctx.fillEllipse(in: CGRect(x: c.x - 46, y: c.y + 10, width: 92, height: 92))
    ctx.setFillColor(rgb(0xF1EFF8))
    ctx.fillEllipse(in: CGRect(x: c.x - 26, y: c.y + 30, width: 52, height: 52))

    write(ctx, to: "\(outRoot)/AppIcon.appiconset/AppIcon-1024.png")
}

// MARK: Discreet icon: plain "Daylight" look with no safety cues.
do {
    let ctx = makeContext()
    let s = CGFloat(size)
    let c = CGPoint(x: s / 2, y: s / 2)
    let g = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: [rgb(0xFBE7C6), rgb(0xF4C98E)] as CFArray, locations: [0, 1])!
    ctx.drawLinearGradient(g, start: CGPoint(x: 0, y: s), end: CGPoint(x: s, y: 0), options: [])
    ctx.setFillColor(rgb(0xFFFFFF, 0.9))
    ctx.fillEllipse(in: CGRect(x: c.x - 210, y: c.y - 210, width: 420, height: 420))
    ctx.setStrokeColor(rgb(0xE59A4C)); ctx.setLineWidth(28); ctx.setLineCap(.round)
    for i in 0..<8 {
        let a = CGFloat(i) * .pi / 4
        ctx.move(to: CGPoint(x: c.x + cos(a) * 270, y: c.y + sin(a) * 270))
        ctx.addLine(to: CGPoint(x: c.x + cos(a) * 340, y: c.y + sin(a) * 340))
    }
    ctx.strokePath()
    write(ctx, to: "\(outRoot)/AppIconDiscreet.appiconset/AppIconDiscreet-1024.png")
}

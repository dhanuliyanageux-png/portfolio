// Regenerates the hero character frames in assets/hero/ from the source video.
// macOS only (AVFoundation + CoreGraphics; no ffmpeg needed).
//
//   swiftc -O tools/build-hero-frames.swift -o /tmp/build-hero
//   /tmp/build-hero "path/to/video.mp4" assets/hero all 0.66
//
// Last argument: JPEG quality (0-1). Clip name can be idle | gaze | greet | all.
// After regenerating, bump FRAME_VER in assets/js/hero.js (and the poster's ?v= in
// index.html) so browsers don't serve the old frames from cache.
//
// Clips:
//   idle   working at the laptop (source 0-1.5s), looped ping-pong
//   gaze   one continuous axis the cursor scrubs along (24fps source frames):
//            gaze-00..34  real frames, looking left (2.6s) -> facing you (4.0s)
//            gaze-35..68  the same head mirrored onto the facing pose -> looking right
//   greet  headset off, wave, point down (source 3.6-10s)
//
// Every frame is cropped to 940x620 (the whole laptop, with room to spare on the right)
// and also gets:
//   - the laptop lid recoloured from white to silver aluminium (fixed polygon:
//     lidPoly / lipPoly, cropped-frame coordinates) plus a thin edge line, tinted
//     before the backdrop is normalised so the lid keeps its shading;
//   - the backdrop flattened to pure white: a quadratic surface is fitted to the
//     background-only parts of a clean frame (fitPlate) and divided out, then
//     near-white is snapped to 255 so it compresses flat;
//   - the left/right/top edges faded to white, so the frames sit on the white page
//     with no mask or blend mode at runtime.
//
// The time ranges below are specific to the current video. The right-hand half of
// `gaze` has no source footage: it is the left-look head, mirrored about the head's
// centre and pasted onto the facing pose; the first few mirrored frames are
// cross-faded with the real facing frame so the hand-over has no visible pop.
// If you use a new video, adjust the times, the crop rect, the head and laptop
// coordinates, then update CLIPS / GAZE_C / GREET_FROM and the 0.404 head position
// in assets/js/hero.js (and the 940/620 aspect ratio in style.css) so everything
// matches what this script prints.
import AVFoundation
import AppKit

// build <video> <outDir> <clip|all> [quality]
// Extracts cropped, background-whitened JPEG frames for the hero character.
let args = CommandLine.arguments
let asset = AVAsset(url: URL(fileURLWithPath: args[1]))
let outDir = args[2]
let which = args[3]
let quality = args.count > 4 ? Double(args[4])! : 0.72
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

let SW = 1280, SH = 720
// crop rect in top-left coordinates
let crop = CGRect(x: 240, y: 100, width: 940, height: 620)
let gain = 255.0 / 229.0
let cs = CGColorSpaceCreateDeviceRGB()

func grab(_ t: Double) -> CGImage {
    return try! gen.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil)
}

func newCtx(_ w: Int, _ h: Int) -> CGContext {
    return CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: cs,
                     bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
}

// feathered elliptical mask (top-left coords -> CG coords)
func headMask(cx: Double, cy: Double, rx: Double, ry: Double, inner: Double) -> CGImage {
    let g = CGContext(data: nil, width: SW, height: SH, bitsPerComponent: 8, bytesPerRow: SW,
                      space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
    g.setFillColor(gray: 0, alpha: 1); g.fill(CGRect(x: 0, y: 0, width: SW, height: SH))
    // 3 stops, each a (gray, alpha) pair
    let g3 = CGGradient(colorSpace: CGColorSpaceCreateDeviceGray(),
                        colorComponents: [1, 1, 1, 1, 0, 1] as [CGFloat],
                        locations: [0, CGFloat(inner), 1] as [CGFloat], count: 3)!
    g.saveGState()
    g.translateBy(x: cx, y: Double(SH) - cy)
    g.scaleBy(x: rx, y: ry)
    g.drawRadialGradient(g3, startCenter: .zero, startRadius: 0, endCenter: .zero, endRadius: 1, options: [])
    g.restoreGState()
    return g.makeImage()!
}

// Clear the original head from `base`: fill the head box with a per-row
// horizontal blend of the background sampled just outside it.
func cleanedBase(_ base: CGImage) -> CGImage {
    let c = newCtx(SW, SH)
    c.draw(base, in: CGRect(x: 0, y: 0, width: SW, height: SH))
    let d = c.data!.assumingMemoryBound(to: UInt8.self)
    let bpr = c.bytesPerRow
    func sample(_ x: Int, _ y: Int) -> [CGFloat] {
        let i = y * bpr + x * 4
        return [CGFloat(d[i]) / 255, CGFloat(d[i + 1]) / 255, CGFloat(d[i + 2]) / 255]
    }
    let x0 = 470, x1 = 775
    for y in 108...382 {
        let l = sample(x0 - 12, y), r = sample(x1 + 12, y)
        let g = CGGradient(colorSpace: cs, colorComponents: [l[0], l[1], l[2], 1, r[0], r[1], r[2], 1] as [CGFloat],
                           locations: [0, 1] as [CGFloat], count: 2)!
        let rowY = CGFloat(SH - y - 1)
        c.saveGState()
        c.clip(to: CGRect(x: x0, y: Int(rowY), width: x1 - x0, height: 1))
        c.drawLinearGradient(g, start: CGPoint(x: x0, y: 0), end: CGPoint(x: x1, y: 0), options: [])
        c.restoreGState()
    }
    return c.makeImage()!
}

// Composite mirrored head of `look` onto `base` (full-res frames).
func mirroredHead(base: CGImage, look: CGImage, axisLook: Double, axisBase: Double, dy: Double, mask: CGImage) -> CGImage {
    let c = newCtx(SW, SH)
    c.draw(cleanedBase(base), in: CGRect(x: 0, y: 0, width: SW, height: SH))
    c.saveGState()
    c.clip(to: CGRect(x: 0, y: 0, width: SW, height: SH), mask: mask)
    c.translateBy(x: axisLook + axisBase, y: -dy)   // dy: move down in top-left coords => negative in CG
    c.scaleBy(x: -1, y: 1)
    c.draw(look, in: CGRect(x: 0, y: 0, width: SW, height: SH))
    c.restoreGState()
    return c.makeImage()!
}

// ---- laptop: cream/white lid -> Apple-style silver aluminium -------------------
// Polygon of the lid (and the light chassis lip under it), in the *cropped* frame's
// pixel coordinates (top-left origin). The laptop never moves and her hands/arms
// stay left of the lid, so a fixed outline is enough.
let lapOff = (x: 320.0, y: 340.0)     // laptop-crop origin (560,440) minus frame crop origin (240,100)
let lidPoly: [(Double, Double)] = [(245, 42), (474, 40), (477, 232), (462, 246), (414, 254), (184, 264), (216, 152)]
let lipPoly: [(Double, Double)] = [(184, 262), (414, 250), (420, 257), (190, 271)]

func polygonMask(_ polys: [[(Double, Double)]], w: Int, h: Int) -> [Float] {
    let g = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w,
                      space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
    g.setFillColor(gray: 0, alpha: 1); g.fill(CGRect(x: 0, y: 0, width: w, height: h))
    g.setFillColor(gray: 1, alpha: 1)
    g.setShouldAntialias(true)
    for poly in polys {
        g.beginPath()
        for (i, p) in poly.enumerated() {
            let pt = CGPoint(x: p.0 + lapOff.x, y: Double(h) - (p.1 + lapOff.y))
            if i == 0 { g.move(to: pt) } else { g.addLine(to: pt) }
        }
        g.closePath(); g.fillPath()
    }
    let d = g.data!.assumingMemoryBound(to: UInt8.self)
    var m = [Float](repeating: 0, count: w * h)
    for y in 0..<h { for x in 0..<w { m[y * w + x] = Float(d[y * w + x]) / 255 } }
    return m
}
var silverMaskCache: [Float]? = nil

// ---- backdrop flattening --------------------------------------------------------
// The wall behind her is a smooth, slightly uneven off-white (darker toward the corners,
// a touch warm at the bottom right). Fit a quadratic surface to background-only regions
// of a clean frame and use it to normalise the backdrop to pure white, instead of one
// flat brightness boost.
func fitPlate(_ img: CGImage) -> [[Double]] {
    let c = newCtx(SW, SH)
    c.draw(img, in: CGRect(x: 0, y: 0, width: SW, height: SH))
    let d = c.data!.assumingMemoryBound(to: UInt8.self)
    let bpr = c.bytesPerRow
    // background-only boxes in source coordinates (top-left origin) at t = 0.8s
    let boxes: [(Int, Int, Int, Int)] = [(240, 100, 370, 640), (1070, 100, 1180, 640),
                                         (240, 100, 1180, 126), (240, 100, 480, 440), (780, 100, 1060, 470)]
    func basis(_ x: Double, _ y: Double) -> [Double] {
        let u = (x - 640) / 640, v = (y - 360) / 360
        return [1, u, v, u * u, u * v, v * v]
    }
    var coefs: [[Double]] = []
    for ch in 0..<3 {
        var ata = [[Double]](repeating: [Double](repeating: 0, count: 6), count: 6)
        var atz = [Double](repeating: 0, count: 6)
        for b in boxes {
            var y = b.1
            while y < b.3 {
                var x = b.0
                while x < b.2 {
                    let z = Double(d[y * bpr + x * 4 + ch])
                    let f = basis(Double(x), Double(y))
                    for i in 0..<6 { atz[i] += f[i] * z; for j in 0..<6 { ata[i][j] += f[i] * f[j] } }
                    x += 6
                }
                y += 6
            }
        }
        // Gaussian elimination
        var m = ata, r = atz
        for i in 0..<6 {
            var p = i
            for k in i..<6 where abs(m[k][i]) > abs(m[p][i]) { p = k }
            m.swapAt(i, p); r.swapAt(i, p)
            for k in (i + 1)..<6 {
                let f = m[k][i] / m[i][i]
                for j in i..<6 { m[k][j] -= f * m[i][j] }
                r[k] -= f * r[i]
            }
        }
        var sol = [Double](repeating: 0, count: 6)
        for i in stride(from: 5, through: 0, by: -1) {
            var t = r[i]
            for j in (i + 1)..<6 where j < 6 { t -= m[i][j] * sol[j] }
            sol[i] = t / m[i][i]
        }
        coefs.append(sol)
    }
    return coefs
}
var gainMapCache: [[Float]]? = nil
func gainMaps(w: Int, h: Int) -> [[Float]] {
    if let g = gainMapCache { return g }
    let coefs = fitPlate(grab(0.8))
    var maps = [[Float]](repeating: [Float](repeating: 1, count: w * h), count: 3)
    for ch in 0..<3 {
        for y in 0..<h { for x in 0..<w {
            let sx = Double(x) + crop.origin.x, sy = min(Double(y) + crop.origin.y, 650)   // desk below y~650: hold the gain
            let u = (sx - 640) / 640, v = (sy - 360) / 360
            let f = [1, u, v, u * u, u * v, v * v]
            var plate = 0.0
            for i in 0..<6 { plate += coefs[ch][i] * f[i] }
            maps[ch][y * w + x] = Float(max(1.0, min(1.4, 255.0 / max(plate, 1))))
        } }
    }
    gainMapCache = maps
    return maps
}

func smooth(_ t: Double) -> Double { let c = max(0, min(1, t)); return c * c * (3 - 2 * c) }

func finish(_ img: CGImage, name: String) -> Int {
    let cropped = img.cropping(to: crop)!
    let w = Int(crop.width), h = Int(crop.height)
    let c = newCtx(w, h)
    c.draw(cropped, in: CGRect(x: 0, y: 0, width: w, height: h))
    let d = c.data!.assumingMemoryBound(to: UInt8.self)
    let bpr = c.bytesPerRow
    if silverMaskCache == nil { silverMaskCache = polygonMask([lidPoly, lipPoly], w: w, h: h) }
    let sm = silverMaskCache!
    let gm = gainMaps(w: w, h: h)
    // silver: darker, cooler, with a soft sheen from top-left to bottom-right
    let x0 = 245 + lapOff.x, y0 = 42 + lapOff.y
    let span = 231.0 * 0.6 + 174.0 * 0.8
    let tint: [Double] = [0.965, 0.98, 1.0]
    let fadeX = Double(w) * 0.06, fadeY = Double(h) * 0.07
    for y in 0..<h { for x in 0..<w {
        let i = y * bpr + x * 4
        let m = Double(sm[y * w + x])
        var px = [Double(d[i]), Double(d[i + 1]), Double(d[i + 2])]
        if m > 0.003 {
            let t = max(0, min(1, ((Double(x) - x0) * 0.6 + (Double(y) - y0) * 0.8) / span))
            let f = 0.79 + (0.67 - 0.79) * t
            for k in 0..<3 { px[k] = px[k] * (1 - m) + px[k] * f * tint[k] * m }
        }
        // whiten the near-white backdrop
        for k in 0..<3 { px[k] = min(255, px[k] * Double(gm[k][y * w + x])) }
        // snap near-white to true white (a soft shoulder from 244 up), so the backdrop
        // compresses as flat white instead of a faint 253-254 mottle
        for k in 0..<3 {
            let v = px[k]
            if v >= 250 { px[k] = 255 } else if v > 244 { px[k] = v + (255 - v) * smooth((v - 244) / 6) }
        }
        // bake the edge feather (left/right/top) toward white; multiply-blend makes white transparent
        let wgt = smooth(Double(x) / fadeX) * smooth(Double(w - 1 - x) / fadeX) * smooth(Double(y) / fadeY)
        for k in 0..<3 { d[i + k] = UInt8(max(0, min(255, px[k] * wgt + 255 * (1 - wgt)))) }
    } }
    // thin edge line around the lid (top, right and left edges)
    c.saveGState()
    c.setStrokeColor(CGColor(red: 0.36, green: 0.39, blue: 0.44, alpha: 0.30))
    c.setLineWidth(1.4)
    c.setLineJoin(.round)
    c.beginPath()
    let edge: [(Double, Double)] = [(216, 152), (245, 42), (474, 40), (477, 232), (462, 246)]
    for (i, p) in edge.enumerated() {
        let pt = CGPoint(x: p.0 + lapOff.x, y: Double(h) - (p.1 + lapOff.y))
        if i == 0 { c.move(to: pt) } else { c.addLine(to: pt) }
    }
    c.strokePath()
    c.restoreGState()
    if name == "idle-03" {
        func at(_ x: Int, _ y: Int) -> String { let i = y * bpr + x * 4; return "(\(d[i]),\(d[i+1]),\(d[i+2]))" }
        print("backdrop after flatten  left \(at(70, 300))  topleft \(at(140, 90))  top \(at(500, 60))  right \(at(880, 150))  rightmid \(at(880, 400))  farright \(at(900, 520))")
    }
    let out = c.makeImage()!
    let rep = NSBitmapImageRep(cgImage: out)
    let data = rep.representation(using: .jpeg, properties: [.compressionFactor: quality])!
    try! data.write(to: URL(fileURLWithPath: "\(outDir)/\(name).jpg"))
    return data.count
}

func pad(_ n: Int) -> String { return n < 10 ? "0\(n)" : "\(n)" }

var total = 0
func run(_ clip: String, from: Double, to: Double, fps: Double, mode: String = "plain") {
    let n = Int(((to - from) * fps).rounded()) + 1
    var bytes = 0
    let base = grab(0.8)
    let mask = headMask(cx: 620, cy: 272, rx: 215, ry: 178, inner: 0.82)
    for k in 0..<n {
        let t = min(to, from + Double(k) / fps)
        var img = grab(t)
        if mode == "mirror" {
            img = mirroredHead(base: base, look: img, axisLook: 612, axisBase: 628, dy: 8, mask: mask)
        }
        bytes += finish(img, name: "\(clip)-\(pad(k))")
    }
    print("\(clip): \(n) frames, \(bytes / 1024) KB")
    total += bytes
}

// One continuous gaze axis: left peak -> facing the visitor -> right peak (mirrored).
// gaze-00 ... gaze-34 : real frames, source 2.6s (looking left) -> 4.0s (facing camera)  (24fps)
// gaze-35 ... gaze-68 : mirrored heads on the facing pose, centre-most first.
// The first few mirrored frames are cross-faded with the real facing frame, so the
// hand-over from the real half to the mirrored half has no visible pop.
func runGaze() {
    let tA = 2.6, tC = 4.0, n = 35
    let base = grab(tC)
    let mask = headMask(cx: 620, cy: 272, rx: 215, ry: 178, inner: 0.82)
    var bytes = 0
    let times = (0..<n).map { tA + (tC - tA) * Double($0) / Double(n - 1) }
    let real = times.map { grab($0) }
    var idx = 0
    for img in real { bytes += finish(img, name: "gaze-\(pad(idx))"); idx += 1 }
    let ramp: [Double] = [0.28, 0.5, 0.7, 0.85, 0.94]
    for (j, img) in real.dropLast().reversed().enumerated() {
        let mir = mirroredHead(base: base, look: img, axisLook: 620, axisBase: 620, dy: 0, mask: mask)
        var out = mir
        if j < ramp.count {
            let c = newCtx(SW, SH)
            c.draw(base, in: CGRect(x: 0, y: 0, width: SW, height: SH))
            c.setAlpha(CGFloat(ramp[j]))
            c.draw(mir, in: CGRect(x: 0, y: 0, width: SW, height: SH))
            out = c.makeImage()!
        }
        bytes += finish(out, name: "gaze-\(pad(idx))"); idx += 1
    }
    print("gaze: \(idx) frames, \(bytes / 1024) KB")
    total += bytes
}

if which == "idle" || which == "all" { run("idle", from: 0.0, to: 1.5, fps: 6) }
if which == "gaze" || which == "all" { runGaze() }
if which == "greet" || which == "all" { run("greet", from: 3.6, to: 10.0, fps: 16) }
print("total \(total / 1024) KB")

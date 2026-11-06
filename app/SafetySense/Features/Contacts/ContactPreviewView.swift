import SwiftUI

/// "What your contacts see" (18p, O7): an example of the live link, built here in the app. It
/// makes no network call and creates no alert, and its buttons only explain that nothing is
/// sent. Times are relative so it never disagrees with the phone's clock.
struct ContactPreviewView: View {
    @Environment(AppModel.self) private var model
    @State private var showNothingSent = false

    private var name: String { model.profile?.firstName.isEmpty == false ? model.profile?.firstName ?? "Alex" : "Alex" }
    private var people: String { NameList.join(model.contacts.map(\.firstName)) }
    private var firstContact: String { model.contacts.first?.firstName ?? "Your contact" }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SSSpacing.md) {
                HStack {
                    Text("SafetySense · live link").ssEyebrow()
                    Spacer()
                    Text("Updated just now").ssEyebrow()
                }
                Card {
                    VStack(alignment: .leading, spacing: SSSpacing.sm) {
                        StatusPill(text: "Preview · example", systemImage: "eye", tint: SSColor.accent)
                        Text("\(name) may need help").font(SSFont.display)
                            .fixedSize(horizontal: false, vertical: true)
                        Text("Example only. Nothing is happening right now. This is what \(people) would see if an alert fired.")
                            .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Card {
                    VStack(spacing: SSSpacing.sm) {
                        ExampleMap()
                        HStack(spacing: SSSpacing.xs) {
                            stat("Updated", "1 min ago")
                            stat("Battery", "62%")
                            stat("Accuracy", "±18 m")
                        }
                        PrimaryButton("Open in Maps for directions", role: .secondary) { showNothingSent = true }
                    }
                }
                Card {
                    VStack(alignment: .leading, spacing: SSSpacing.sm) {
                        Text("Can you help?").font(SSFont.headline)
                        PrimaryButton("I'm on my way", role: .calm) { showNothingSent = true }
                        PrimaryButton("I called 911", role: .secondary) { showNothingSent = true }
                        PrimaryButton("Send help now", role: .danger) { showNothingSent = true }
                        Text("If they're in immediate danger, call 911 first. SafetySense helps people reach help faster; it doesn't replace 911.")
                            .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Card {
                    VStack(alignment: .leading, spacing: SSSpacing.xs) {
                        Text("Sealed details").font(SSFont.headline)
                        Text("Filled in for Walk Home, Date and Ride: the route, who you're meeting, or the plate and driver. It's shown only while an alert is active.")
                            .font(SSFont.callout)
                            .padding(SSSpacing.sm)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(SSColor.accentSoft, in: RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous))
                    }
                }
                Card {
                    VStack(alignment: .leading, spacing: SSSpacing.xs) {
                        Text("What's happened").font(SSFont.headline)
                        event("Dispatch requested", "1m ago")
                        event("\(firstContact) was called", "2m ago")
                        event("Alert started", "2m ago")
                    }
                }
            }
            .padding(.top, SSSpacing.sm)
            .padding(.bottom, SSSpacing.xl)
        }
        .scrollIndicators(.hidden)
        .ssScreen()
        .navigationTitle("Preview")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(SSColor.background, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
        .alert("Nothing is sent from a preview", isPresented: $showNothingSent) {
            Button("Got it", role: .cancel) {}
        } message: {
            Text("On a real live link, this button adds \(firstContact)'s response to \(name)'s alert timeline. This page is only an example, so nothing happens.")
        }
    }

    private func stat(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).ssEyebrow()
            Text(value).font(SSFont.headline).lineLimit(1).minimumScaleFactor(0.8)
        }
        .padding(SSSpacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SSColor.surfaceRaised, in: RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private func event(_ text: String, _ time: String) -> some View {
        HStack {
            Text(text).font(SSFont.callout)
            Spacer()
            Text(time).font(SSFont.mono(12)).foregroundStyle(SSColor.inkMuted)
        }
        .frame(minHeight: 28)
        .accessibilityElement(children: .combine)
    }
}

/// A drawn street grid, not a real map: no tiles, no location, and no doubt that it's an example.
private struct ExampleMap: View {
    var body: some View {
        Canvas { context, size in
            context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(SSColor.surfaceRaised))
            var streets = Path()
            for x in stride(from: size.width * 0.12, to: size.width, by: size.width * 0.22) {
                streets.move(to: CGPoint(x: x, y: 0))
                streets.addLine(to: CGPoint(x: x + 18, y: size.height))
            }
            for y in stride(from: size.height * 0.16, to: size.height, by: size.height * 0.3) {
                streets.move(to: CGPoint(x: 0, y: y))
                streets.addLine(to: CGPoint(x: size.width, y: y - 14))
            }
            context.stroke(streets, with: .color(SSColor.line), lineWidth: 5)
        }
        .frame(height: 210)
        .overlay { LocationPulse() }
        .overlay(alignment: .bottomTrailing) {
            Text("Example map").font(SSFont.caption.weight(.semibold))
                .padding(.horizontal, 10).padding(.vertical, 6)
                .background(.ultraThinMaterial, in: Capsule())
                .padding(SSSpacing.xs)
        }
        .clipShape(RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Example map with a location dot.")
    }
}

#Preview { NavigationStack { ContactPreviewView() }.environment(AppModel.preview(screen: .contacts)) }

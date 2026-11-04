import SwiftUI

/// The full-screen call (SPEC 7.7). It deliberately looks like the phone's own call screen,
/// not like SafetySense: no brand colors, no app name, nothing that says "fake".
struct FakeCallScreen: View {
    @Environment(AppModel.self) private var model

    private var scheduler: FakeCallScheduler { model.fakeCall }

    var body: some View {
        ZStack {
            CallBackdrop()
            switch scheduler.phase {
            case .ringing:
                IncomingCallView(config: scheduler.config,
                                 onAccept: { scheduler.accept() },
                                 onDecline: { scheduler.decline() })
                    .transition(.opacity)
            case .inCall(let answeredAt):
                InCallView(config: scheduler.config, answeredAt: answeredAt,
                           onEnd: { scheduler.hangUp() })
                    .transition(.opacity)
            case .idle, .scheduled:
                Color.clear
            }
        }
        .animation(.easeInOut(duration: 0.25), value: scheduler.phase)
        .preferredColorScheme(.dark)
        .statusBarHidden(false)
    }
}

// MARK: - Backdrop

/// A dark, softly blurred wash, like a contact poster behind the call.
private struct CallBackdrop: View {
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.16, green: 0.18, blue: 0.24),
                                    Color(red: 0.07, green: 0.08, blue: 0.11),
                                    Color(red: 0.03, green: 0.03, blue: 0.05)],
                           startPoint: .top, endPoint: .bottom)
            Circle()
                .fill(Color(red: 0.36, green: 0.40, blue: 0.52).opacity(0.35))
                .frame(width: 420, height: 420)
                .blur(radius: 120)
                .offset(x: -80, y: -260)
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}

// MARK: - Incoming

struct IncomingCallView: View {
    let config: FakeCallConfig
    let onAccept: () -> Void
    let onDecline: () -> Void
    @State private var pulse = false
    @State private var accepted = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: 0) {
            CallerHeader(config: config, subtitle: "mobile")
                .padding(.top, 56)
            Spacer()
            CallerAvatar(initials: config.initials, size: 132)
                .scaleEffect(pulse ? 1.03 : 1)
                .onAppear {
                    guard !reduceMotion else { return }
                    withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) { pulse = true }
                }
            Spacer()
            HStack {
                SmallCallAction(title: "Remind Me", systemImage: "alarm.fill", action: onDecline)
                Spacer()
                SmallCallAction(title: "Message", systemImage: "message.fill", action: onDecline)
            }
            .padding(.horizontal, 44)
            .padding(.bottom, 40)

            switch config.answerStyle {
            case .buttons:
                HStack {
                    CallButton(title: "Decline", systemImage: "phone.down.fill", fill: .callRed, action: onDecline)
                    Spacer()
                    CallButton(title: "Accept", systemImage: "phone.fill", fill: .callGreen) {
                        accepted += 1
                        onAccept()
                    }
                }
                .padding(.horizontal, 44)
                .padding(.bottom, 56)
            case .slide:
                SlideToAnswer(onAnswer: { accepted += 1; onAccept() })
                    .padding(.horizontal, 32)
                    .padding(.bottom, 64)
            }
        }
        .foregroundStyle(.white)
        .sensoryFeedback(.impact(weight: .medium), trigger: accepted)
    }
}

// MARK: - In call

struct InCallView: View {
    let config: FakeCallConfig
    let answeredAt: Date
    let onEnd: () -> Void
    @State private var muted = false
    @State private var speaker = false
    @State private var keypad = false
    @State private var ended = 0

    var body: some View {
        VStack(spacing: 0) {
            TimelineView(.periodic(from: answeredAt, by: 1)) { context in
                CallerHeader(config: config, subtitle: Self.clock(context.date.timeIntervalSince(answeredAt)))
            }
            .padding(.top, 56)
            Spacer()
            CallerAvatar(initials: config.initials, size: 96)
                .opacity(keypad ? 0 : 1)
            Spacer()
            Grid(horizontalSpacing: 26, verticalSpacing: 26) {
                GridRow {
                    ToggleCallButton(title: "Speaker", systemImage: "speaker.wave.2.fill", isOn: $speaker)
                    ToggleCallButton(title: "FaceTime", systemImage: "video.fill", isOn: .constant(false))
                    ToggleCallButton(title: "Mute", systemImage: "mic.slash.fill", isOn: $muted)
                }
                GridRow {
                    ToggleCallButton(title: "Add", systemImage: "person.badge.plus", isOn: .constant(false))
                    CallButton(title: "End", systemImage: "phone.down.fill", fill: .callRed) {
                        ended += 1
                        onEnd()
                    }
                    ToggleCallButton(title: "Keypad", systemImage: "circle.grid.3x3.fill", isOn: $keypad)
                }
            }
            .padding(.bottom, 64)
        }
        .foregroundStyle(.white)
        .sensoryFeedback(.impact(weight: .light), trigger: ended)
    }

    static func clock(_ seconds: TimeInterval) -> String {
        let s = max(0, Int(seconds))
        return s >= 3600 ? String(format: "%d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
                         : String(format: "%d:%02d", s / 60, s % 60)
    }
}

// MARK: - Parts

private extension Color {
    static let callGreen = Color(red: 0.20, green: 0.78, blue: 0.35)
    static let callRed = Color(red: 0.92, green: 0.23, blue: 0.21)
    static let callGlass = Color.white.opacity(0.16)
}

private struct CallerHeader: View {
    let config: FakeCallConfig
    let subtitle: String

    var body: some View {
        VStack(spacing: 6) {
            Text(config.displayName)
                .font(.system(size: 38, weight: .regular))
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .padding(.horizontal, 24)
            Text(subtitle)
                .font(.system(size: 19))
                .monospacedDigit()
                .foregroundStyle(.white.opacity(0.65))
                .contentTransition(.numericText())
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

private struct CallerAvatar: View {
    let initials: String
    let size: CGFloat

    var body: some View {
        Circle()
            .fill(LinearGradient(colors: [Color(white: 0.62), Color(white: 0.42)], startPoint: .top, endPoint: .bottom))
            .frame(width: size, height: size)
            .overlay(Text(initials).font(.system(size: size * 0.4, weight: .medium, design: .rounded)).foregroundStyle(.white))
            .accessibilityHidden(true)
    }
}

private struct CallButton: View {
    let title: String
    let systemImage: String
    let fill: Color
    let action: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            Button(action: action) {
                Image(systemName: systemImage)
                    .font(.system(size: 30, weight: .medium))
                    .frame(width: 76, height: 76)
                    .background(fill, in: Circle())
            }
            .buttonStyle(CallPressStyle())
            .accessibilityLabel(title)
            Text(title).font(.system(size: 14)).foregroundStyle(.white.opacity(0.9)).accessibilityHidden(true)
        }
    }
}

private struct ToggleCallButton: View {
    let title: String
    let systemImage: String
    @Binding var isOn: Bool

    var body: some View {
        VStack(spacing: 8) {
            Button { isOn.toggle() } label: {
                Image(systemName: systemImage)
                    .font(.system(size: 26, weight: .medium))
                    .foregroundStyle(isOn ? Color.black : .white)
                    .frame(width: 76, height: 76)
                    .background(isOn ? Color.white : Color.callGlass, in: Circle())
            }
            .buttonStyle(CallPressStyle())
            .accessibilityLabel(title)
            .accessibilityAddTraits(isOn ? .isSelected : [])
            Text(title).font(.system(size: 14)).foregroundStyle(.white.opacity(0.9)).accessibilityHidden(true)
        }
    }
}

private struct SmallCallAction: View {
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: systemImage).font(.system(size: 20))
                Text(title).font(.system(size: 13))
            }
            .foregroundStyle(.white.opacity(0.9))
            .frame(minWidth: 72, minHeight: 48)
        }
        .buttonStyle(.plain)
    }
}

private struct CallPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .brightness(configuration.isPressed ? 0.15 : 0)
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .animation(.snappy(duration: 0.12), value: configuration.isPressed)
    }
}

/// "slide to answer": drag the green knob to the end of the track.
struct SlideToAnswer: View {
    let onAnswer: () -> Void
    @State private var offset: CGFloat = 0
    @State private var shimmer = false
    private let knob: CGFloat = 64
    private let inset: CGFloat = 6

    var body: some View {
        GeometryReader { geo in
            let maxOffset = max(0, geo.size.width - knob - inset * 2)
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.16))
                Text("slide to answer")
                    .font(.system(size: 20))
                    .foregroundStyle(.white.opacity(shimmer ? 0.95 : 0.55))
                    .frame(maxWidth: .infinity)
                    .padding(.leading, knob * 0.6)
                    .opacity(1 - Double(offset / max(1, maxOffset)) * 1.4)
                Circle()
                    .fill(Color.callGreen)
                    .frame(width: knob, height: knob)
                    .overlay(Image(systemName: "phone.fill").font(.system(size: 26, weight: .medium)))
                    .offset(x: inset + offset)
                    .gesture(DragGesture()
                        .onChanged { offset = min(max(0, $0.translation.width), maxOffset) }
                        .onEnded { _ in
                            if offset > maxOffset * 0.85 {
                                offset = maxOffset
                                onAnswer()
                            } else {
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) { offset = 0 }
                            }
                        })
            }
        }
        .frame(height: knob + inset * 2)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.3).repeatForever(autoreverses: true)) { shimmer = true }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Slide to answer")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { onAnswer() }
    }
}

#Preview("Incoming") {
    let model = AppModel.preview(screen: .fakeCallIncoming)
    return FakeCallScreen().environment(model)
}

#Preview("In call") {
    let model = AppModel.preview(screen: .fakeCallActive)
    return FakeCallScreen().environment(model)
}

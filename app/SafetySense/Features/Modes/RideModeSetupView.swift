import SwiftUI

/// Ride setup (SPEC 5): log the car before you get in. Shared only if an alert fires.
struct RideModeSetupView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var ride = RideDetails()
    @State private var car = ""
    @State private var destinationFix: LocationFix?
    @State private var minutes = 35
    @State private var listen = true
    @State private var isStarting = false
    @State private var started = 0

    private var canStart: Bool { !ride.plate.trimmingCharacters(in: .whitespaces).isEmpty }

    private var arrivalTime: String {
        Date.now.addingTimeInterval(Double(minutes) * 60).formatted(date: .omitted, time: .shortened)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SSSpacing.lg) {
                SetupHeader(mode: .ride, title: "Log your ride",
                            subtitle: "Takes ten seconds. SafetySense checks in when you should have arrived.")

                VStack(alignment: .leading, spacing: SSSpacing.sm) {
                    Text("Service").ssEyebrow()
                    FlowRow(spacing: SSSpacing.xs) {
                        ForEach(RideDetails.Service.allCases) { s in
                            Chip(title: s.displayName, isSelected: ride.service == s) {
                                withAnimation(.snappy) { ride.service = s }
                            }
                        }
                    }
                }

                platePreview

                VStack(alignment: .leading, spacing: SSSpacing.md) {
                    SetupField(label: "License plate", text: Binding(get: { ride.plate }, set: { ride.plate = $0.uppercased() }),
                               prompt: "ABC-1234", systemImage: "car.rear", capitalization: .characters, monospaced: true)
                    SetupField(label: "Driver", text: $ride.driverName, prompt: "Name in the app", systemImage: "person")
                    SetupField(label: "Car (optional)", text: $car, prompt: "Silver Camry", systemImage: "car")
                    DestinationField(label: "Going to (optional)", text: $ride.destinationName, fix: $destinationFix, prompt: "Home, a friend's place…",
                                     isSearchEnabled: model.services.flavor == .live)
                }

                VStack(alignment: .leading, spacing: SSSpacing.sm) {
                    Text("Trip length").ssEyebrow()
                    MinuteChips(minutes: $minutes, options: [15, 20, 30, 35, 45, 60])
                }

                Card { ListenOnTheWayToggle(isOn: $listen) }

                SealedExplainer(title: "Shared only if you need help", points: [
                    ("eye.slash", "Your contacts don't see the car or driver unless an alert fires."),
                    ("location.north.line", "During the ride SafetySense watches for a long unplanned stop or going off route."),
                ])

            }
            .padding(.top, SSSpacing.md)
            .padding(.bottom, SSSpacing.lg)
        }
        .scrollDismissesKeyboard(.interactively)
        .pinnedFooter {
            PrimaryButton("Start Ride guard", systemImage: "car.fill", isLoading: isStarting) { start() }
                .disabled(!canStart)
            Text(canStart ? model.alertDelivery.rideFooter(arrival: arrivalTime, names: NameList.join(model.contacts.map(\.firstName)),
                                                           count: model.contacts.count)
                 : "Add the plate to start.")
                .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                .multilineTextAlignment(.center)
        }
        .ssScreen()
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(SSColor.background, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        }
        .sensoryFeedback(.success, trigger: started)
        .onAppear { listen = model.settings.listensDuringRide }
    }

    /// A little license-plate preview that fills in as you type.
    private var platePreview: some View {
        VStack(spacing: 2) {
            Text("NEW MEXICO").font(SSFont.mono(10, weight: .bold)).foregroundStyle(SSColor.danger)
            Text(ride.plate.isEmpty ? "— — —" : ride.plate)
                .font(.system(size: 30, weight: .heavy, design: .monospaced))
                .foregroundStyle(Color(hex: 0x1B1A2B))
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .contentTransition(.numericText())
            Text("Land of Enchantment").font(.system(size: 10, weight: .semibold, design: .serif)).foregroundStyle(Color(hex: 0x1B1A2B).opacity(0.7))
        }
        .padding(.vertical, SSSpacing.sm)
        .frame(width: 220)
        .background(Color(hex: 0xF4E3A1), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Color(hex: 0x1B1A2B).opacity(0.4), lineWidth: 2))
        .frame(maxWidth: .infinity)
        .animation(.snappy, value: ride.plate)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(ride.plate.isEmpty ? "No plate yet" : "Plate \(ride.plate)")
    }

    private func start() {
        isStarting = true
        var details = ride
        details.plate = details.plate.trimmingCharacters(in: .whitespaces)
        details.carDescription = car.isEmpty ? nil : car
        details.expectedArrival = Date.now.addingTimeInterval(Double(minutes) * 60)
        let checkAfter = Double(minutes) * 60
        let picked = destinationFix
        let place = details.destinationName.trimmingCharacters(in: .whitespaces)
        let canSearch = model.services.flavor == .live
        Task {
            var fix = picked
            if fix == nil, canSearch, !place.isEmpty { fix = await DestinationSearch.fix(forText: place) }
            details.destinationLatitude = fix?.latitude
            details.destinationLongitude = fix?.longitude
            await model.startGuard(mode: .ride, ride: details, arrivalCheckAfter: checkAfter)
            isStarting = false
            started += 1
            dismiss()
        }
    }
}

#Preview { NavigationStack { RideModeSetupView() }.environment(AppModel.preview(screen: .rideSetup)) }

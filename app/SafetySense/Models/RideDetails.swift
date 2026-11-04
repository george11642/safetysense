import Foundation

/// Ride-mode details (SPEC 5): logged at the start of a ride, shared only in an alert.
struct RideDetails: Codable, Sendable, Equatable {
    enum Service: String, Codable, Sendable, CaseIterable, Identifiable {
        case uber, lyft, friend, other
        var id: String { rawValue }
        var displayName: String {
            switch self {
            case .uber: "Uber"
            case .lyft: "Lyft"
            case .friend: "A friend"
            case .other: "Other"
            }
        }
    }

    var service: Service
    var driverName: String
    var plate: String
    var carDescription: String?
    var destinationName: String
    var destinationLatitude: Double?
    var destinationLongitude: Double?
    var expectedArrival: Date?

    init(service: Service = .uber, driverName: String = "", plate: String = "",
         carDescription: String? = nil, destinationName: String = "",
         destinationLatitude: Double? = nil, destinationLongitude: Double? = nil,
         expectedArrival: Date? = nil) {
        self.service = service
        self.driverName = driverName
        self.plate = plate
        self.carDescription = carDescription
        self.destinationName = destinationName
        self.destinationLatitude = destinationLatitude
        self.destinationLongitude = destinationLongitude
        self.expectedArrival = expectedArrival
    }

    var sealedSummary: String {
        var lines = ["Ride: \(service.displayName)", "Driver: \(driverName)", "Plate: \(plate)"]
        if let carDescription, !carDescription.isEmpty { lines.append("Car: \(carDescription)") }
        lines.append("Going to: \(destinationName)")
        return lines.joined(separator: "\n")
    }
}

extension RideDetails {
    /// Destination as a fix for route / arrival checks (nil when no coordinates were picked).
    var destinationFix: LocationFix? {
        guard let lat = destinationLatitude, let lng = destinationLongitude else { return nil }
        return LocationFix(latitude: lat, longitude: lng, accuracy: 50)
    }
}

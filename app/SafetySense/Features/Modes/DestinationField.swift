import CoreLocation
import MapKit
import SwiftUI

/// Finds places as the person types. Searches go to Apple Maps only while this field is in use,
/// and only the typed text is sent.
@Observable
@MainActor
final class DestinationSearch: NSObject, @preconcurrency MKLocalSearchCompleterDelegate {
    private(set) var results: [MKLocalSearchCompletion] = []
    @ObservationIgnored private let completer = MKLocalSearchCompleter()

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = [.address, .pointOfInterest]
    }

    func update(query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty {
            results = []
            completer.cancel()
        } else {
            completer.queryFragment = trimmed
        }
    }

    func clear() {
        results = []
        completer.cancel()
    }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        results = Array(completer.results.prefix(4))
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: any Error) {
        results = []
    }

    /// Coordinates for a picked suggestion.
    static func fix(for completion: MKLocalSearchCompletion) async -> LocationFix? {
        await first(MKLocalSearch.Request(completion: completion))
    }

    /// Best match for typed text the person didn't pick from the list. It can come back nil, and
    /// the session then simply has no arrival detection, so it must not hold up Start for long.
    static func fix(forText text: String) async -> LocationFix? {
        await withTaskGroup(of: LocationFix?.self) { group in
            group.addTask { await search(text) }
            group.addTask {
                try? await Task.sleep(for: .seconds(3))
                return nil
            }
            let result = await group.next() ?? nil
            group.cancelAll()
            return result
        }
    }

    private static func search(_ text: String) async -> LocationFix? {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = text
        return await first(request)
    }

    private static func first(_ request: MKLocalSearch.Request) async -> LocationFix? {
        guard let item = try? await MKLocalSearch(request: request).start().mapItems.first else { return nil }
        let location = item.location
        return LocationFix(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude, accuracy: 50)
    }
}

/// "Going to" with place suggestions. Demo and QA runs stay offline and behave as plain text.
struct DestinationField: View {
    let label: String
    @Binding var text: String
    @Binding var fix: LocationFix?
    var prompt = ""
    var isSearchEnabled = true

    @State private var search = DestinationSearch()
    @State private var picked = ""

    var body: some View {
        VStack(alignment: .leading, spacing: SSSpacing.xs) {
            SetupField(label: label, text: $text, prompt: prompt, systemImage: "mappin.and.ellipse")
            if isSearchEnabled, !search.results.isEmpty {
                Card(padding: 0) {
                    VStack(spacing: 0) {
                        ForEach(Array(search.results.enumerated()), id: \.offset) { i, place in
                            if i > 0 { Divider().overlay(SSColor.line).padding(.leading, SSSpacing.md) }
                            Button { choose(place) } label: {
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(place.title).font(SSFont.callout.weight(.semibold)).foregroundStyle(SSColor.ink)
                                    if !place.subtitle.isEmpty {
                                        Text(place.subtitle).font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                                    }
                                }
                                .lineLimit(1)
                                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                                .padding(.horizontal, SSSpacing.md)
                                .padding(.vertical, SSSpacing.xs)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .onChange(of: text) { _, new in
            guard new != picked else { return }
            fix = nil
            if isSearchEnabled { search.update(query: new) }
        }
    }

    private func choose(_ place: MKLocalSearchCompletion) {
        picked = place.title
        text = place.title
        search.clear()
        Task { fix = await DestinationSearch.fix(for: place) }
    }
}

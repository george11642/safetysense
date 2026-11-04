import SwiftUI
import WidgetKit

// OWNER: System Integration module.
@main
struct SafetySenseWidgetsBundle: WidgetBundle {
    var body: some Widget {
        GuardLiveActivity()
        SOSControlWidget()
        GuardControlWidget()
    }
}

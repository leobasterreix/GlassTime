import SwiftUI

/// Barre d'onglets flottante en verre liquide (iOS 26), calquée sur le design
/// de TabBar.tsx côté web : pilule arrondie, ancrée en bas, icône + libellé.
///
/// Un seul élément porte le vrai `.glassEffect()` natif (la pilule de fond,
/// qui flOute/réfracte authentiquement le contenu web en dessous). Le halo
/// dégradé de l'onglet sélectionné est un `matchedGeometryEffect` classique
/// plutôt qu'un second verre imbriqué : empiler plusieurs `.glassEffect()`
/// proches produit des artefacts de rendu (« le verre ne peut pas échantillonner
/// un autre verre »), déjà observés en test sur simulateur.
struct LiquidTabBar: View {
    @Binding var selection: AppTab
    @Namespace private var highlightNamespace

    var body: some View {
        HStack(spacing: 4) {
            ForEach(AppTab.allCases) { tab in
                tabButton(for: tab)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .glassEffect(.regular, in: Capsule())
        .padding(.horizontal, 20)
    }

    @ViewBuilder
    private func tabButton(for tab: AppTab) -> some View {
        let isSelected = tab == selection

        Button {
            guard selection != tab else { return }
            withAnimation(.bouncy(duration: 0.35)) {
                selection = tab
            }
        } label: {
            VStack(spacing: 3) {
                Image(systemName: tab.systemImage)
                    .font(.system(size: 21, weight: .semibold))
                Text(tab.title)
                    .font(.system(size: 10.5, weight: .semibold))
            }
            .foregroundStyle(isSelected ? .white : .secondary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background {
                if isSelected {
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [.blue, .purple],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .matchedGeometryEffect(id: "tabHighlight", in: highlightNamespace)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

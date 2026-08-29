import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        NavigationStack {
            Form {
                Section("Conta LTS Health") {
                    if model.isSignedIn {
                        Label("Conta conectada", systemImage: "checkmark.circle.fill")
                        Button("Sair") { Task { await model.signOut() } }
                    } else {
                        TextField("E-mail", text: $model.email)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled()
                        SecureField("Senha", text: $model.password)
                        Button("Entrar") { Task { await model.signIn() } }
                            .disabled(model.isBusy)
                    }
                }

                Section("Apple Saúde") {
                    Button("Conectar Apple Saúde") {
                        Task { await model.connectHealthAndInitialSync() }
                    }
                    .disabled(!model.isSignedIn || model.isBusy)

                    Button("Sincronizar agora") {
                        Task { await model.syncNow() }
                    }
                    .disabled(!model.isSignedIn || model.isBusy)

                    if let lastSyncAt = model.lastSyncAt {
                        LabeledContent("Última sincronização") {
                            Text(lastSyncAt, style: .relative)
                        }
                    }

                    Text("Energia ativa, minutos de exercício e horas em pé seguem como canônicos do ActivitySummary. Passos, FC de repouso, HRV, frequência respiratória e peso podem ser enviados como candidatos com origem preservada; eles não são promovidos automaticamente até validação específica.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if model.isBusy {
                    Section { ProgressView("Processando…") }
                }

                if !model.message.isEmpty {
                    Section("Status") { Text(model.message) }
                }
            }
            .navigationTitle("LTS Health Sync")
        }
    }
}

import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var model: AppModel

    private var statusIcon: String {
        switch model.statusKind {
        case .success: return "checkmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .error: return "xmark.circle.fill"
        case .info: return "info.circle.fill"
        }
    }

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

                Section("Preparação") {
                    Label(model.isSignedIn ? "Conta pronta" : "Entre na conta", systemImage: model.isSignedIn ? "checkmark.circle.fill" : "circle")
                    Label(model.healthConfigured ? "Apple Saúde configurado" : "Apple Saúde ainda não configurado", systemImage: model.healthConfigured ? "checkmark.circle.fill" : "circle")
                    Label(model.sourceSyncConfigured ? "Leitura por origem configurada" : "Leitura por origem ainda não configurada", systemImage: model.sourceSyncConfigured ? "checkmark.circle.fill" : "circle")
                    if model.activationReady {
                        Label("Atualização em segundo plano preparada", systemImage: "arrow.triangle.2.circlepath.circle.fill")
                    }
                }

                Section("Apple Saúde") {
                    Button(model.healthConfigured ? "Revisar permissões e sincronizar histórico" : "Conectar Apple Saúde") {
                        Task { await model.connectHealthAndInitialSync() }
                    }
                    .disabled(!model.isSignedIn || model.isBusy)

                    Button("Sincronizar agora") {
                        Task { await model.syncNow() }
                    }
                    .disabled(!model.isSignedIn || model.isBusy || !model.healthConfigured)

                    if let lastSyncAt = model.lastSyncAt {
                        LabeledContent("Último sucesso") {
                            Text(lastSyncAt, style: .relative)
                        }
                        if let summary = model.lastSyncSummary {
                            Text(summary)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    } else {
                        Text("Nenhuma sincronização concluída neste aparelho ainda.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("O que entra automaticamente") {
                    Text("Energia ativa, minutos de exercício e horas em pé entram como dados principais do Apple Saúde.")
                    Text("Passos, frequência cardíaca de repouso, HRV, frequência respiratória, peso e nutrientes compatíveis ficam preservados por origem para evitar misturas indevidas.")
                    Text("Quando o MyFitnessPal compartilha alimentação com o Apple Saúde, calorias e macros compatíveis podem chegar por esse caminho. Alimentos, refeições e horários não são inventados.")
                    Text("Sono compatível também fica preservado por origem. Intervalos sobrepostos da mesma origem são unidos antes do total diário, e fontes diferentes não são somadas entre si automaticamente.")
                }
                .font(.footnote)
                .foregroundStyle(.secondary)

                if model.isBusy {
                    Section { ProgressView("Sincronizando…") }
                }

                if !model.message.isEmpty {
                    Section("Status") {
                        Label(model.message, systemImage: statusIcon)
                    }
                }
            }
            .navigationTitle("LTS Health Sync")
        }
    }
}

# 3D Ar Condicionado - Checklist de Quadros Elétricos

Sistema web moderno e responsivo, inspirado na interface do Asana, desenvolvido para conferência técnica e liberação de quadros elétricos da **3D Ar Condicionado**.

---

## 🚀 Funcionalidades

- **Dashboard Principal (Aba Inicial):** Visão geral com métricas, total de relatórios, não-conformidades registradas e listagem completa dos relatórios gerados.
- **Menu Lateral Direito (Estilo Asana):** Acesso rápido ao histórico de relatórios com barra de pesquisa em tempo real.
- **Numeração Sequencial Automática:** Histórico contínuo e progressivo no padrão `Relatório Nº 1`, `Relatório Nº 2`, etc.
- **Checklist Interativo com Sim/Não:**
  - Opções rápidas para cada item.
  - Ao marcar **NÃO**, um campo de justificativa se expande dinamicamente para descrever a não-conformidade.
  - Botão de conveniência "Marcar Todos Sim" por seção.
- **Grupos de Inspeção:**
  - **Tampa:** Identificação do quadro, lâmpadas, seccionadoras, fechaduras, IHM, aterramento, venezianas e exaustores.
  - **Conferência Interna:** Miolo, canaletas e tampas, projeto elétrico, disjuntores, contatores, inversores, conversores, relés, bornes, fontes, iluminação interna e reapertos.
  - **Cabeamento:** Reaperto, cabos de potência, comando, rede, isolamento, cores fora de padrão e terminais.
  - **Observações Gerais:** Campo livre para informações e recomendações adicionais.
- **Assinatura Digital:** Canvas interativo com suporte a toque (touch) ou mouse para validação do responsável técnico.
- **Seleção de Inspetor:** Dropdown pré-populado com os membros da equipe técnica:
  - *Gustavo Henrique*, *Luis Henrique*, *Pedro Miguel*, *Henri Rodrigues*, *Reinaldo Ferreira*, *Victor Hugo*.
- **Exportação Profissional:**
  - **PDF:** Laudo formatado com logotipo oficial da 3D Ar Condicionado, dados da obra, tabelas de conferência, não-conformidades destacadas e assinatura do inspetor.
  - **Excel (.xlsx):** Planilha estruturada gerada diretamente pelo navegador.
- **Edição e Exclusão:** Gerenciamento completo dos relatórios já criados.
- **Persistência em Nuvem (Firebase Firestore) & Fallback Local:** Sincronização em tempo real com o banco de dados Firebase e armazenamento offline resiliente via `localStorage`.

---

## 🌐 Como Acessar via GitHub Pages

O site é 100% estático (HTML5, Tailwind CSS, Vanilla JS) e roda diretamente no GitHub Pages:

1. Acesse o repositório no GitHub: `https://github.com/victorhugomota/CheckListQuadros3DAR`
2. Vá em **Settings** > **Pages**
3. Em **Build and deployment** > **Branch**, selecione `main` e a pasta `/ (root)`.
4. Clique em **Save**.
5. O link público ficará disponível em:
   **`https://victorhugomota.github.io/CheckListQuadros3DAR/`**

---

© 3D Ar Condicionado. Todos os direitos reservados.
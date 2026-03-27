# Dashboard de Velocidade da Frota

Projeto estatico em HTML, CSS e JavaScript puro para monitorar velocidade da frota, alertas de excesso e rankings operacionais.

## Estrutura

- `index.html`: pagina principal
- `style.css`: estilos e responsividade
- `script.js`: filtros, cards, rankings e graficos
- `data/`: arquivos processados consumidos pelo dashboard
- `input/`: pasta opcional para colocar as planilhas reais
- `samples/`: exemplo de entrada para testes
- `scripts/process_data.py`: transforma planilhas em JSON/JS
- `atualizar_dados.bat`: executa a atualizacao local

## Como atualizar os dados

1. Coloque os arquivos `.csv`, `.xlsx` ou `.xlsm` na raiz do projeto ou em `input/`.
2. Execute `atualizar_dados.bat`.
3. O script gera:
   - `data/dashboard-data.json`
   - `data/dashboard-data.js`
4. Abra `index.html` localmente ou publique no GitHub Pages.

## Observacoes

- O dashboard mantem todos os registros da base.
- Registros invalidos nao sao apagados; eles aparecem como `Dados invalidos`.
- A velocidade minima de analise e o limite de velocidade podem ser alterados no painel sem reprocessar a base.
- O arquivo `.js` espelha o `.json` para permitir abertura local do `index.html` sem depender de servidor HTTP.
- O Chart.js ja esta incluido localmente em `vendor/`, entao o projeto nao depende de CDN para os graficos.
- O parser aceita cabecalhos como `MOTORISTA`, `Placa`, `Data/Hora`, `Velocidade`, `Eventos` e `Endereço`.
- Quando a coluna `MOTORISTA` vier vazia, o dashboard nao inventa um nome substituto; filtros e rankings de motorista ignoram esse campo vazio.

## Exemplo rapido

Para gerar a base de exemplo incluida no projeto:

```bat
python scripts/process_data.py --input-dir samples --output-json data/dashboard-data.json --output-js data/dashboard-data.js
```

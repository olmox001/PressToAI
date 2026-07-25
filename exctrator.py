def extract_file_from_bundle(bundle_path, target_path):
    """
    Estrae un singolo file da un bundle PressToAI non compresso.

    Il bundle deve essere un file di testo contenente sezioni nel formato:

        @@@ percorso/del/file @@@
        1:contenuto prima riga
        2:contenuto seconda riga
        3:contenuto terza riga
        @@@ altro/file @@@

    Args:
        bundle_path (str):
            Percorso del bundle PressToAI.

        target_path (str):
            Percorso del file da estrarre all'interno del bundle.

    Returns:
        str:
            Contenuto del file estratto.

    Raises:
        FileNotFoundError:
            Se il bundle specificato non esiste.

        ValueError:
            Se il file richiesto non è presente nel bundle.
    """

    content = []
    in_target = False
    target_marker = f"@@@ {target_path} @@@"

    with open(
        bundle_path,
        "r",
        encoding="utf-8",
        errors="replace"
    ) as bundle:

        for line in bundle:

            # Rimuove esclusivamente il newline per confrontare
            # correttamente il marker.
            marker_line = line.rstrip("\r\n")

            # Rileva i marker delle sezioni del bundle.
            if (
                marker_line.startswith("@@@ ")
                and marker_line.endswith(" @@@")
            ):
                # Se eravamo già dentro il file richiesto,
                # abbiamo raggiunto la sezione successiva.
                if in_target:
                    break

                # Individua il file richiesto.
                if marker_line == target_marker:
                    in_target = True
                    continue

            # Se siamo dentro la sezione richiesta,
            # aggiungiamo il contenuto alla destinazione.
            if in_target:

                # Gestisce righe con numero di riga:
                #
                # 123:contenuto
                #
                # 123: è il prefisso generato dal bundle.
                if ":" in line:
                    prefix, file_content = line.split(":", 1)

                    if prefix.isdigit():
                        content.append(file_content)
                        continue

                # Gestisce righe senza numerazione.
                content.append(line)

    if not in_target:
        raise ValueError(
            f"Il file '{target_path}' non è stato trovato "
            f"nel bundle '{bundle_path}'."
        )

    return "".join(content)


def main():
    # ============================================================
    # BUNDLE PRESS TO AI DA UTILIZZARE
    # ============================================================

    bundle_path = input(
        "Inserisci il percorso del bundle PressToAI: "
    ).strip()

    # ============================================================
    # FILE DA ESTRARRE DAL BUNDLE
    # ============================================================

    target_path = input(
        "Inserisci il percorso del file da estrarre: "
    ).strip()

    print()
    print(f"Bundle: {bundle_path}")
    print(f"File da estrarre: {target_path}")
    print()

    # ============================================================
    # ESTRAZIONE
    # ============================================================

    try:
        content = extract_file_from_bundle(
            bundle_path=bundle_path,
            target_path=target_path,
        )

        print("Estrazione completata!")
        print(f"Caratteri estratti: {len(content)}")
        print()
        print("========== CONTENUTO ==========")
        print(content)
        print("================================")

    except FileNotFoundError:
        print(
            f"ERRORE: il bundle non esiste:\n"
            f"{bundle_path}"
        )

    except ValueError as error:
        print(f"ERRORE: {error}")


if __name__ == "__main__":
    main()

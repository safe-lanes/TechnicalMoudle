interface ComponentMaker {
  maker?: string | null;
  makerCode?: string | null;
}

interface ListedMaker {
  makerName: string;
  makerCode: string;
}

export function resolveSpareMakerDefault(
  component: ComponentMaker | null | undefined,
  makers: ListedMaker[],
): { maker: string; makerCode: string } {
  const code = component?.makerCode?.trim().toLowerCase();
  const name = component?.maker?.trim().toLowerCase();
  const match =
    (code && makers.find(m => m.makerCode.trim().toLowerCase() === code)) ||
    (name && makers.find(m => m.makerName.trim().toLowerCase() === name));

  return match
    ? { maker: match.makerName, makerCode: match.makerCode }
    : { maker: "", makerCode: "" };
}
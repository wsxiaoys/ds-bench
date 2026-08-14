defmodule Vault.Ledger.Checkpoint do
  use Ash.Resource,
    domain: Vault.Ledger,
    data_layer: Ash.DataLayer.Ets

  ets do
    private? true
  end

  attributes do
    attribute :name, :string, primary_key?: true, allow_nil?: false, public?: true
    attribute :sequence, :integer, allow_nil?: false, public?: true
  end

  actions do
    defaults [:read]

    create :create do
      accept [:name, :sequence]
    end

    update :update do
      accept [:sequence]
    end
  end
end

defmodule Vault.Ledger.Checkpoint do
  use Ash.Resource,
    domain: Vault.Ledger,
    data_layer: Ash.DataLayer.Ets

  ets do
    private? true
  end

  attributes do
    attribute :name, :string do
      primary_key? true
      allow_nil? false
      public? true
    end

    attribute :sequence, :integer do
      allow_nil? false
      public? true
    end
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

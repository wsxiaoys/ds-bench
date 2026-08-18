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
    defaults [:read, :destroy]

    create :create do
      accept :*
    end

    update :update do
      accept :*
      require_atomic? false
    end
  end
end

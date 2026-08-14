defmodule OrgGuard.Access.User do
  use Ash.Resource,
    domain: OrgGuard.Access,
    data_layer: Ash.DataLayer.Ets

  ets do
    private? false
  end

  attributes do
    uuid_primary_key :id

    attribute :email, :string do
      allow_nil? false
      public? true
    end

    attribute :status, :atom do
      allow_nil? false
      default :active
      constraints one_of: [:active, :suspended]
      public? true
    end

    attribute :global_role, :atom do
      allow_nil? false
      default :member
      constraints one_of: [:member, :break_glass]
      public? true
    end
  end

  actions do
    read :read do
      primary? true
    end

    create :create do
      primary? true
      accept [:email, :status, :global_role]
    end
  end
end

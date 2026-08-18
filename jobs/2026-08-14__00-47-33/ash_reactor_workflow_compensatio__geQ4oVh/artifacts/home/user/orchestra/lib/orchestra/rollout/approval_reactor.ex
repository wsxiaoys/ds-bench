defmodule Orchestra.Rollout.ApprovalReactor do
  use Ash.Reactor

  ash do
    default_domain Orchestra.Fleet
  end

  input :rollout_id
  input :total_slots
  input :board_threshold

  step :is_board_level do
    argument :total_slots, input(:total_slots)
    argument :board_threshold, input(:board_threshold)
    run fn %{total_slots: slots, board_threshold: threshold}, _ ->
      {:ok, slots >= threshold}
    end
  end

  switch :choose_level do
    on result(:is_board_level)

    matches? &(&1 == true) do
      return :create_board_approval

      create :create_board_approval, Orchestra.Fleet.Approval, :create do
        inputs %{
          rollout_id: input(:rollout_id),
          slots: input(:total_slots),
          level: value(:board),
          status: value(:granted)
        }
      end
    end

    matches? &(&1 == false) do
      return :create_auto_approval

      create :create_auto_approval, Orchestra.Fleet.Approval, :create do
        inputs %{
          rollout_id: input(:rollout_id),
          slots: input(:total_slots),
          level: value(:auto),
          status: value(:granted)
        }
      end
    end
  end
end
